/**
 * Square order data-creation handlers for rest-api-ia-automation.
 */
const crypto = require("crypto");
const { Logger } = require("@celigo/aut-logger");
const { SCENARIOS } = require("./squareOrderScenarios");
const { RETURN_ORDER_SCENARIOS, REFUND_KINDS } = require("./squareReturnScenarios");

const SQUARE_API_VERSION = "2024-01-17";

function decodeSquareToken() {
  const encoded = process.env["CONNECTIONS.SQUARE_TOKEN"];
  if (!encoded) throw new Error("CONNECTIONS.SQUARE_TOKEN is not set in env");
  return Buffer.from(encoded, "base64").toString("utf8").replace(/^Bearer\s+/i, "");
}

function squareHost() {
  return (process.env.SQUARE_ENVIRONMENT || "production") === "production"
    ? "connect.squareup.com"
    : "connect.squareupsandbox.com";
}

async function squareRequest(method, path, body, token) {
  const url = `https://${squareHost()}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Square-Version": SQUARE_API_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = json?.errors?.[0]?.detail || JSON.stringify(json);
    throw new Error(`Square API ${method} ${path} failed (${response.status}): ${detail}`);
  }
  return json;
}

function uid(prefix) {
  return `${prefix}-${crypto.randomUUID().substring(0, 8)}`;
}

const catalogCache = new Map();

async function fetchCatalogItem(token, itemId) {
  if (catalogCache.has(itemId)) return catalogCache.get(itemId);
  const res = await squareRequest("GET", `/v2/catalog/object/${itemId}?include_related_objects=true`, null, token);
  const item = res.object;
  const variation = item?.item_data?.variations?.[0];
  if (!variation) throw new Error(`No catalog variation for Square item ${itemId}`);
  const taxIds = item.item_data?.tax_ids || [];
  const taxes = (res.related_objects || []).filter((o) => o.type === "TAX" && taxIds.includes(o.id));
  const info = { variationId: variation.id, taxes, itemName: item.item_data?.name, itemId };
  catalogCache.set(itemId, info);
  return info;
}

function loadCatalogIds() {
  try {
    const fs = require("fs");
    const path = require("path");
    const file = path.join(process.env.PWD || ".", "config/squareCatalogIds.json");
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return {};
  }
}

function loadModifierId(modifierKey = 1) {
  if (modifierKey === 2) {
    const ids = loadCatalogIds();
    if (ids.MODIFIER_2_ID) return ids.MODIFIER_2_ID;
    if (process.env["SQUARE_CATALOG.MODIFIER_2_ID"]) return process.env["SQUARE_CATALOG.MODIFIER_2_ID"];
  }
  if (process.env["SQUARE_CATALOG.MODIFIER_ID"]) return process.env["SQUARE_CATALOG.MODIFIER_ID"];
  const ids = loadCatalogIds();
  return ids.MODIFIER_ID;
}

async function resolveCustomer(token, customerType, map, prefix) {
  if (!customerType) return undefined;
  if (customerType === "EXISTING") {
    const email = process.env["DEFAULT_CUSTOMER.EMAIL"];
    const search = await squareRequest(
      "POST",
      "/v2/customers/search",
      { query: { filter: { email_address: { exact: email } } } },
      token
    );
    const id = search.customers?.[0]?.id;
    if (id) {
      map.set(`${prefix}squareCustomerId`, id);
      return id;
    }
    const created = await squareRequest(
      "POST",
      "/v2/customers",
      {
        idempotency_key: crypto.randomUUID(),
        given_name: process.env["DEFAULT_CUSTOMER.FIRST_NAME"] || "Square",
        family_name: process.env["DEFAULT_CUSTOMER.LAST_NAME"] || "Test",
        email_address: email,
      },
      token
    );
    map.set(`${prefix}squareCustomerId`, created.customer.id);
    return created.customer.id;
  }
  if (customerType === "NEW") {
    const email = `sqautomation+${Date.now()}@celigo.test`;
    const res = await squareRequest(
      "POST",
      "/v2/customers",
      {
        idempotency_key: crypto.randomUUID(),
        given_name: "Square",
        family_name: "Automation",
        email_address: email,
      },
      token
    );
    map.set(`${prefix}squareCustomerId`, res.customer.id);
    map.set(`${prefix}squareCustomerEmail`, email);
    return res.customer.id;
  }
  if (customerType === "NEW_NO_EMAIL") {
    const res = await squareRequest(
      "POST",
      "/v2/customers",
      {
        idempotency_key: crypto.randomUUID(),
        given_name: "Square",
        family_name: "NoEmail",
      },
      token
    );
    map.set(`${prefix}squareCustomerId`, res.customer.id);
    return res.customer.id;
  }
  return undefined;
}

function resolveCatalogKey(catalogKey, fallbackKey) {
  const map = {
    BOTTLE: process.env["SQUARE_CATALOG.BOTTLE_ITEM_ID"],
    TEST_PRODUCT: process.env["SQUARE_CATALOG.TEST_PRODUCT_ID"],
    LOT_ITEM: process.env["SQUARE_CATALOG.LOT_ITEM_ID"] || loadCatalogIds().LOT_ITEM_ID,
    SERIAL_ITEM: process.env["SQUARE_CATALOG.SERIAL_ITEM_ID"] || loadCatalogIds().SERIAL_ITEM_ID,
  };
  const id = map[catalogKey] || (fallbackKey ? map[fallbackKey] : null);
  if (!id) throw new Error(`Unknown catalogKey: ${catalogKey}`);
  return id;
}

function buildOrderBody({ locationId, lineSpecs, orderDiscounts, tipCents, customLines, scenarioName, customerId }) {
  const orderDiscountUids = (orderDiscounts || []).map(() => uid("odisc"));
  const taxesByCatalogId = new Map();

  const line_items = lineSpecs.map((spec, idx) => {
    const lineUid = uid(`li${idx}`);
    const appliedDiscounts = [];
    if (spec.lineDiscount) {
      const dUid = uid("ldisc");
      appliedDiscounts.push({ uid: uid("ad"), discount_uid: dUid });
      spec._lineDiscountUid = dUid;
      spec._lineDiscountDef = spec.lineDiscount;
    }
    orderDiscountUids.forEach((dUid) => {
      appliedDiscounts.push({ uid: uid("ad"), discount_uid: dUid });
    });

    if (spec.adhoc) {
      return {
        uid: lineUid,
        name: spec.name || "Ad-hoc item",
        quantity: String(spec.qty ?? 1),
        base_price_money: { amount: spec.priceCents, currency: "USD" },
        note: `${scenarioName} adhoc line ${idx + 1}`,
      };
    }

    const taxUids = (spec.taxes || []).map((t) => {
      const tUid = `tax-${t.id}`;
      taxesByCatalogId.set(t.id, { uid: tUid, catalog_object_id: t.id, scope: "LINE_ITEM" });
      return tUid;
    });

    const line = {
      uid: lineUid,
      catalog_object_id: spec.variationId,
      quantity: String(spec.qty ?? 1),
      base_price_money: { amount: spec.priceCents, currency: "USD" },
      applied_taxes: taxUids.map((tax_uid) => ({ uid: uid("at"), tax_uid })),
      applied_discounts: appliedDiscounts,
      note: `${scenarioName} line ${idx + 1}`,
    };

    if (spec.modifiers?.length) {
      const usedModIds = new Set();
      line.modifiers = [];
      for (const m of spec.modifiers) {
        let modId = loadModifierId(m.modifierKey || 1);
        if (!modId) continue;
        if (usedModIds.has(modId)) {
          const alt = loadModifierId(m.modifierKey === 2 ? 1 : 2);
          if (alt && !usedModIds.has(alt)) modId = alt;
          else continue;
        }
        usedModIds.add(modId);
        line.modifiers.push({
          catalog_object_id: modId,
          quantity: String(m.qty || 1),
        });
      }
    }

    if (!Number.isInteger(spec.qty) && spec.qty != null && !spec.variationId) {
      line.quantity_unit = {
        measurement_unit: {
          type: "TYPE_CUSTOM",
          custom_unit: { name: "Each", abbreviation: "ea" },
        },
        precision: 2,
      };
    }

    return line;
  });

  for (const cl of customLines || []) {
    line_items.push({
      uid: uid("custom"),
      name: cl.name || "Custom amount",
      quantity: "1",
      base_price_money: { amount: cl.priceCents, currency: "USD" },
    });
  }

  const discounts = [];
  lineSpecs.forEach((spec) => {
    if (spec._lineDiscountUid) {
      discounts.push({
        uid: spec._lineDiscountUid,
        name: `Line ${spec._lineDiscountDef.percentage}% discount`,
        percentage: String(spec._lineDiscountDef.percentage),
        scope: "LINE_ITEM",
      });
    }
  });
  (orderDiscounts || []).forEach((od, i) => {
    discounts.push({
      uid: orderDiscountUids[i],
      name: od.name || `Order ${od.percentage}% discount`,
      percentage: String(od.percentage),
      scope: "ORDER",
    });
  });

  const taxes = [...taxesByCatalogId.values()];

  const order = {
    location_id: locationId,
    line_items,
    taxes,
    discounts,
    metadata: { scenario: scenarioName },
  };

  if (customerId) order.customer_id = customerId;

  if (tipCents && tipCents > 0) {
    order.tip_money = { amount: tipCents, currency: "USD" };
  }

  return { idempotency_key: crypto.randomUUID(), order };
}

async function createGiftCard(token, locationId, amountCents) {
  const create = await squareRequest(
    "POST",
    "/v2/gift-cards",
    { idempotency_key: crypto.randomUUID(), location_id: locationId, gift_card: { type: "DIGITAL" } },
    token
  );
  const giftCardId = create.gift_card.id;
  await squareRequest(
    "POST",
    "/v2/gift-cards/activities",
    {
      idempotency_key: crypto.randomUUID(),
      gift_card_activity: {
        type: "ACTIVATE",
        location_id: locationId,
        gift_card_id: giftCardId,
        activate_activity_details: { amount_money: { amount: amountCents, currency: "USD" } },
      },
    },
    token
  );
  return giftCardId;
}

async function payOrderAmount(token, { orderId, locationId, amountCents, type, giftCardId, autocomplete = true }) {
  const body = {
    idempotency_key: crypto.randomUUID(),
    amount_money: { amount: amountCents, currency: "USD" },
    order_id: orderId,
    location_id: locationId,
    autocomplete,
  };
  if (giftCardId) {
    body.source_id = giftCardId;
  } else if (type === "CHECK") {
    body.source_id = "EXTERNAL";
    body.external_details = { type: "CHECK", source: "Check" };
  } else {
    body.source_id = "CASH";
    body.cash_details = {
      buyer_supplied_money: { amount: amountCents, currency: "USD" },
      change_back_money: { amount: 0, currency: "USD" },
    };
  }
  return squareRequest("POST", "/v2/payments", body, token);
}

async function payOrderWithPayments(token, orderId, paymentIds) {
  return squareRequest("POST", `/v2/orders/${orderId}/pay`, {
    idempotency_key: crypto.randomUUID(),
    payment_ids: paymentIds,
  }, token);
}

/** @returns {string|null} primary payment id for Refunds API */
async function applyScenarioPayment(token, order, locationId, payment) {
  if (!payment) return null;
  const total = order.total_money?.amount || 0;
  const paymentIds = [];
  let lastPaymentId = null;

  if (payment.giftCardFull) {
    const gcId = await createGiftCard(token, locationId, total);
    const p = await payOrderAmount(token, {
      orderId: order.id,
      locationId,
      amountCents: total,
      giftCardId: gcId,
      autocomplete: false,
    });
    paymentIds.push(p.payment.id);
    lastPaymentId = p.payment.id;
    await payOrderWithPayments(token, order.id, paymentIds);
    return lastPaymentId;
  }
  if (payment.giftCardPartial) {
    const partial = Math.max(100, Math.min(Math.floor(total / 2), total - 100));
    const gcId = await createGiftCard(token, locationId, partial);
    const p1 = await payOrderAmount(token, {
      orderId: order.id,
      locationId,
      amountCents: partial,
      giftCardId: gcId,
      autocomplete: false,
    });
    const p2 = await payOrderAmount(token, {
      orderId: order.id,
      locationId,
      amountCents: total - partial,
      type: "CASH",
      autocomplete: false,
    });
    await payOrderWithPayments(token, order.id, [p1.payment.id, p2.payment.id]);
    return p2.payment.id;
  }
  if (payment.split?.length) {
    let paid = 0;
    for (let i = 0; i < payment.split.length; i++) {
      const isLast = i === payment.split.length - 1;
      const amount = isLast ? total - paid : Math.floor(total * payment.split[i].ratio);
      paid += amount;
      const p = await payOrderAmount(token, {
        orderId: order.id,
        locationId,
        amountCents: amount,
        type: payment.split[i].type,
        autocomplete: false,
      });
      paymentIds.push(p.payment.id);
    }
    await payOrderWithPayments(token, order.id, paymentIds);
    return paymentIds[paymentIds.length - 1] || null;
  }
  if (payment.type) {
    const p = await payOrderAmount(token, {
      orderId: order.id,
      locationId,
      amountCents: total,
      type: payment.type,
    });
    return p.payment.id;
  }
  return null;
}

function storeOrderKeys(map, prefix, squareOrderId, locationId) {
  const onDemandSync = `${locationId}-${squareOrderId}`;
  map.set(`${prefix}squareOrderId`, squareOrderId);
  map.set(`${prefix}onDemandOrderSync`, onDemandSync);
}

async function createOrderForScenario(scenarioName, map, prefix, scenarioOverride) {
  const scenario = scenarioOverride || SCENARIOS[scenarioName];
  if (!scenario) throw new Error(`Unknown Square scenario: ${scenarioName}`);

  const token = decodeSquareToken();
  const locationId = process.env["SQUARE_PRIMARY_STORE_DATA.LOCATION_ID"];
  if (!locationId) throw new Error("SQUARE_PRIMARY_STORE_DATA.LOCATION_ID is required");

  const lineSpecs = [];
  for (const li of scenario.lineItems) {
    if (li.adhoc) {
      lineSpecs.push({ ...li });
      continue;
    }
    const itemId = resolveCatalogKey(li.catalogKey, li.fallbackCatalogKey);
    const { variationId, taxes, itemName } = await fetchCatalogItem(token, itemId);
    lineSpecs.push({ ...li, variationId, taxes, itemName, lineDiscount: li.lineDiscount });
  }

  Logger.info(`[Square] Creating order scenario=${scenarioName} zephyr=${(scenario.zephyr || []).join(",")}`);
  let customerId;
  if (scenario.customer) {
    customerId = await resolveCustomer(token, scenario.customer, map, prefix);
    if (scenario.attachCustomer === false) customerId = undefined;
  }
  const body = buildOrderBody({
    locationId,
    lineSpecs,
    orderDiscounts: scenario.orderDiscounts,
    tipCents: scenario.tipCents,
    customLines: scenario.customLines,
    scenarioName,
    customerId,
  });

  const res = await squareRequest("POST", "/v2/orders", body, token);
  const order = res.order;
  storeOrderKeys(map, prefix, order.id, locationId);

  if (scenario.payment) {
    const paymentId = await applyScenarioPayment(token, order, locationId, scenario.payment);
    if (paymentId) map.set(`${prefix}squarePaymentId`, paymentId);
  }

  Logger.info(
    `[Square] Order ${order.id} | discount=${order.total_discount_money?.amount} tax=${order.total_tax_money?.amount} tip=${order.total_tip_money?.amount} total=${order.total_money?.amount}`
  );
  return { status: 200, body: order };
}

async function createTenOrdersOnDemand(data, map) {
  const prefix = resolveOrderKeyPrefix(data, "TEN_ORDERS");
  const locationId = process.env["SQUARE_PRIMARY_STORE_DATA.LOCATION_ID"];
  const orderIds = [];

  for (let i = 0; i < 10; i++) {
    const tempPrefix = `${prefix}T${i}`;
    await createOrderForScenario("SINGLE_LINE_BASE", map, tempPrefix);
    orderIds.push(map.get(`${tempPrefix}squareOrderId`));
  }

  const onDemandSync = orderIds.map((id) => `${locationId}-${id}`).join(",");
  map.set(`${prefix}squareOrderId`, orderIds[0]);
  map.set(`${prefix}onDemandOrderSync`, onDemandSync);
  Logger.info(`[Square] Created 10 orders for on-demand sync: ${onDemandSync}`);
  return { status: 200, body: { orderIds } };
}

async function createTenOrdersModifierOnDemand(data, map) {
  const prefix = resolveOrderKeyPrefix(data, "TEN_MOD_ORDERS");
  const locationId = process.env["SQUARE_PRIMARY_STORE_DATA.LOCATION_ID"];
  const orderIds = [];

  for (let i = 0; i < 10; i++) {
    const tempPrefix = `${prefix}T${i}`;
    await createOrderForScenario("SINGLE_LINE_MODIFIER", map, tempPrefix);
    orderIds.push(map.get(`${tempPrefix}squareOrderId`));
  }

  const onDemandSync = orderIds.map((id) => `${locationId}-${id}`).join(",");
  map.set(`${prefix}squareOrderId`, orderIds[0]);
  map.set(`${prefix}onDemandOrderSync`, onDemandSync);
  return { status: 200, body: { orderIds } };
}

async function createValidInvalidOnDemand(data, map) {
  const prefix = resolveOrderKeyPrefix(data, "VALID_INVALID");
  const locationId = process.env["SQUARE_PRIMARY_STORE_DATA.LOCATION_ID"];
  await createOrderForScenario("SINGLE_LINE_BASE", map, prefix);
  const validId = map.get(`${prefix}squareOrderId`);
  map.set(`${prefix}onDemandOrderSync`, `${locationId}-${validId},INVALID-FORMAT-ID`);
  return { status: 200, body: { validId } };
}

async function createElevenOrdersOnDemand(data, map) {
  const prefix = resolveOrderKeyPrefix(data, "ELEVEN_ORDERS");
  const locationId = process.env["SQUARE_PRIMARY_STORE_DATA.LOCATION_ID"];
  const orderIds = [];

  for (let i = 0; i < 11; i++) {
    const tempPrefix = `${prefix}T${i}`;
    await createOrderForScenario("SINGLE_LINE_BASE", map, tempPrefix);
    orderIds.push(map.get(`${tempPrefix}squareOrderId`));
  }

  const onDemandSync = orderIds.map((id) => `${locationId}-${id}`).join(",");
  map.set(`${prefix}squareOrderId`, orderIds[0]);
  map.set(`${prefix}onDemandOrderSync`, onDemandSync);
  Logger.info(`[Square] Created 11 orders for on-demand fail-path: ${onDemandSync}`);
  return { status: 200, body: { orderIds, count: 11 } };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function squareStaticDelay(data) {
  const ms = data?.request?.delayMs || 60000;
  Logger.info(`[Square] Static delay ${ms}ms before flow run`);
  await delay(ms);
  return { status: 200, body: { delayedMs: ms } };
}

async function runSquareOrderFlowWithRetry(data, map) {
  const { apiRequest } = require("@celigo/rest-api-ia-automation/dist/src/helper/apiCalls");
  const prefix = resolveOrderKeyPrefix(data, "FLOW_RUN");
  const flowId = map.get(`${prefix}flowId1`);
  if (!flowId) throw new Error("[Square] flowId1 not found in map for flow run");

  const maxRetries = data?.request?.flowRunMaxRetries ?? 6;
  const retryDelayMs = data?.request?.flowRunRetryDelayMs ?? 10000;
  const token = global.AUTH_TOKEN;
  const baseURL = global.baseURL;
  const contentType = global.CONTENT_TYPE;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await apiRequest("POST", baseURL, `/flows/${flowId}/run`, token, contentType);
    const status = res?.status;
    if (status >= 200 && status < 300) {
      Logger.info(`[Square] Flow run accepted (attempt ${attempt}/${maxRetries})`);
      return res;
    }
    const body = res?.text || JSON.stringify(res?.body || {});
    if (status === 409 && /job_already_queued/.test(body) && attempt < maxRetries) {
      Logger.info(
        `[Square] Flow run 409 busy, waiting ${retryDelayMs}ms then retry ${attempt + 1}/${maxRetries}`
      );
      await delay(retryDelayMs);
      await waitForSquareOrderFlowIdle(data, map);
      continue;
    }
    throw new Error(`[Square] Flow run failed status=${status}: ${body}`);
  }
  throw new Error(`[Square] Flow run failed after ${maxRetries} attempts (409 job_already_queued)`);
}

async function waitForSquareOrderFlowIdle(data, map) {
  const { getInQueueStatus, getInProgressStatus, getFlowID } = require("@celigo/rest-api-ia-automation/dist/src/helper/settings");
  const prefix = resolveOrderKeyPrefix(data, "FLOW_IDLE");
  const flowIdKey = `${prefix}flowId1`;
  let flowId = map.get(flowIdKey);
  const flowName = map.get("FLOW_NAME1") || "Square Order to NetSuite Cash Sale [TestAccount-1 anshul]";
  if (!flowId) {
    flowId = await getFlowID(flowName);
  }

  const maxWaitSec = data?.request?.flowIdleMaxWaitSec || 300;
  const pollSec = 3;
  let elapsed = 0;

  while (elapsed < maxWaitSec) {
    const queued = await getInQueueStatus(flowName, flowId);
    const running = await getInProgressStatus(flowName, flowId);
    if (!queued && !running) {
      Logger.info(`[Square] Flow idle after ${elapsed}s (${flowName})`);
      return { status: 200, body: { idle: true, waitedSec: elapsed } };
    }
    if (elapsed > 0 && elapsed % 30 === 0) {
      Logger.info(`[Square] Waiting for flow idle... ${elapsed}s (queued=${queued}, running=${running})`);
    }
    await delay(pollSec * 1000);
    elapsed += pollSec;
  }

  throw new Error(`[Square] Flow still busy after ${maxWaitSec}s (${flowName}, flowId=${flowId})`);
}

async function createFiveOrdersOnDemand(data, map) {
  const prefix = resolveOrderKeyPrefix(data, "FIVE_ORDERS");
  const locationId = process.env["SQUARE_PRIMARY_STORE_DATA.LOCATION_ID"];
  const orderIds = [];

  for (let i = 0; i < 5; i++) {
    const tempPrefix = `${prefix}T${i}`;
    await createOrderForScenario("SINGLE_LINE_BASE", map, tempPrefix);
    orderIds.push(map.get(`${tempPrefix}squareOrderId`));
  }

  const onDemandSync = orderIds.map((id) => `${locationId}-${id}`).join(",");
  map.set(`${prefix}squareOrderId`, orderIds[0]);
  map.set(`${prefix}onDemandOrderSync`, onDemandSync);
  Logger.info(`[Square] Created 5 orders for on-demand sync: ${onDemandSync}`);
  return { status: 200, body: { orderIds } };
}

function resolveOrderKeyPrefix(data, scenarioName) {
  if (data?.request?.orderKeyPrefix) return data.request.orderKeyPrefix;
  const payloadPath = data?.request?.payload;
  if (typeof payloadPath === "string" && payloadPath.endsWith(".json")) {
    try {
      const fs = require("fs");
      const path = require("path");
      const full = path.join(process.env.PWD || ".", payloadPath.replace(/^\//, ""));
      const json = JSON.parse(fs.readFileSync(full, "utf8"));
      if (json.orderKeyPrefix) return json.orderKeyPrefix;
    } catch (_) {
      /* fallback */
    }
  }
  return scenarioName.replace(/_/g, "");
}

function makeScenarioHandler(scenarioName) {
  return async (data, map) => {
    const prefix = resolveOrderKeyPrefix(data, scenarioName);
    return createOrderForScenario(scenarioName, map, prefix);
  };
}

async function createSquareOrderSC1(_data, map) {
  return createOrderForScenario("ORDER_DISCOUNT_25", map, "PRE25603SC1");
}

function readPayloadJson(data) {
  const payloadPath = data?.request?.payload;
  if (typeof payloadPath !== "string" || !payloadPath.endsWith(".json")) return {};
  try {
    const fs = require("fs");
    const path = require("path");
    const full = path.join(process.env.PWD || ".", payloadPath.replace(/^\//, ""));
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (e) {
    Logger.warn(`[Square] Could not read payload: ${e.message}`);
    return {};
  }
}

async function resolveSquarePaymentId(token, orderId, locationId, map, prefix) {
  let paymentId = map.get(`${prefix}squarePaymentId`);
  if (paymentId) return paymentId;
  const res = await squareRequest(
    "GET",
    `/v2/payments?order_id=${encodeURIComponent(orderId)}&location_id=${encodeURIComponent(locationId)}&sort_order=DESC&limit=10`,
    null,
    token
  );
  paymentId = res.payments?.[0]?.id;
  if (!paymentId) {
    throw new Error(`[Square] No payment found for order ${orderId}`);
  }
  map.set(`${prefix}squarePaymentId`, paymentId);
  return paymentId;
}

async function createSquareReturnOrder(data, map) {
  const payload = readPayloadJson(data);
  const prefix = resolveOrderKeyPrefix(data, payload.orderScenario || "RETURN");
  const scenarioName = payload.orderScenario || "RETURN_SINGLE_LINE";
  const scenario = RETURN_ORDER_SCENARIOS[scenarioName];
  if (!scenario) throw new Error(`Unknown Square return order scenario: ${scenarioName}`);
  return createOrderForScenario(scenarioName, map, prefix, scenario);
}

async function createSquareRefund(data, map) {
  const payload = readPayloadJson(data);
  const prefix = resolveOrderKeyPrefix(data, "REFUND");
  const token = decodeSquareToken();
  const locationId = process.env["SQUARE_PRIMARY_STORE_DATA.LOCATION_ID"];
  const orderId = map.get(`${prefix}squareOrderId`);
  if (!orderId) throw new Error("[Square] squareOrderId missing before refund");

  const paymentId = await resolveSquarePaymentId(token, orderId, locationId, map, prefix);
  const orderRes = await squareRequest("GET", `/v2/orders/${orderId}`, null, token);
  const order = orderRes.order;
  const totalCents = order.total_money?.amount || 0;

  const kind = payload.refundKind || REFUND_KINDS.FULL;
  let amountCents = totalCents;
  if (kind === REFUND_KINDS.HALF_AMOUNT) {
    amountCents = Math.max(1, Math.floor(totalCents / 2));
  } else if (kind === REFUND_KINDS.PARTIAL_PCT) {
    const pct = payload.refundPct ?? 0.25;
    amountCents = Math.max(1, Math.floor(totalCents * pct));
  } else if (kind === REFUND_KINDS.PARTIAL_QTY) {
    const refundQty = payload.refundQty ?? 1;
    const idx = payload.lineIndex ?? 0;
    const li = order.line_items?.[idx];
    const qty = parseFloat(li?.quantity || "1");
    const lineTotal = li?.total_money?.amount || totalCents;
    amountCents = Math.max(1, Math.round((lineTotal / qty) * Math.min(refundQty, qty)));
  } else if (kind === REFUND_KINDS.FIXED_CENTS) {
    amountCents = payload.refundAmountCents ?? 500;
  } else if (kind === REFUND_KINDS.ONE_LINE_ESTIMATE) {
    const lineTotal = order.line_items?.[0]?.total_money?.amount;
    amountCents = lineTotal || Math.floor(totalCents / 2);
  } else if (kind === REFUND_KINDS.PARTIAL_LINE_INDEX) {
    const idx = payload.lineIndex ?? 0;
    const li = order.line_items?.[idx];
    amountCents = li?.total_money?.amount || Math.max(1, Math.floor(totalCents / 2));
  } else if (kind === REFUND_KINDS.ONE_UNIT) {
    const li = order.line_items?.[0];
    const qty = parseFloat(li?.quantity || "1");
    const lineTotal = li?.total_money?.amount || totalCents;
    amountCents = Math.max(1, Math.round(lineTotal / qty));
  }

  Logger.info(
    `[Square] Refund kind=${kind} amount=${amountCents}c order=${orderId} payment=${paymentId}`
  );

  const refundRes = await squareRequest(
    "POST",
    "/v2/refunds",
    {
      idempotency_key: crypto.randomUUID(),
      payment_id: paymentId,
      amount_money: { amount: amountCents, currency: "USD" },
      reason: "Square automation refund",
    },
    token
  );

  const refundId = refundRes.refund.id;
  const refundToken = refundId.includes("_") ? refundId.split("_").pop() : refundId;
  map.set(`${prefix}squareRefundId`, refundId);
  map.set(`${prefix}squareRefundToken`, refundToken);
  map.set(`${prefix}onDemandRefundSync`, `${locationId}-${refundToken}`);
  Logger.info(
    `[Square] Refund ${refundId} (token=${refundToken}) | on-demand sync=${map.get(`${prefix}onDemandRefundSync`)}`
  );

  const settleMs = payload.refundSettleMs ?? 35000;
  if (settleMs > 0) {
    Logger.info(`[Square] Waiting ${settleMs}ms for refund to settle`);
    await delay(settleMs);
  }
  return { status: 200, body: refundRes };
}

function isHttpOk(status) {
  return status >= 200 && status < 300;
}

/** POST connection export (must send body — bare POST returned 401). */
async function postSquareConnectionExport() {
  const { apiRequestWithPayload } = require("@celigo/rest-api-ia-automation/dist/src/helper/apiCalls");
  const connectionId = process.env["CONNECTIONS.SQUARE"];
  if (!global.baseURL || !global.AUTH_TOKEN) {
    throw new Error("[Square] global.baseURL/AUTH_TOKEN not initialized before refund export");
  }
  return apiRequestWithPayload(
    "POST",
    global.baseURL,
    `/connections/${connectionId}/export`,
    {},
    global.AUTH_TOKEN,
    global.CONTENT_TYPE || "application/json"
  );
}

/** Probe IO on-demand refund setting until a sync key is accepted (422 = unknown refund). */
async function probeRefundOnDemandSync(map, prefix, candidates) {
  const { handleSettings } = require("@celigo/rest-api-ia-automation/dist/src/helper/settings");
  const integrationId = map.get(`${prefix}integrationID`);
  if (!integrationId) return null;

  const prevTestCase = process.env.testCaseName;
  process.env.testCaseName = `${prefix}RefundProbe`;

  try {
    for (const syncValue of candidates) {
      map.set(`${prefix}onDemandRefundSync`, syncValue);
      const data = {
        request: {
          method: "PUT",
          path: `/integrations/{{${prefix}integrationID}}/settings/persistSettings`,
          payload: {
            "On-demand refund sync": `{{${prefix}onDemandRefundSync}}`,
          },
          settingsMethod: "updateSettings",
        },
      };
      try {
        const res = await handleSettings(data, map);
        const ok =
          res &&
          (res.status === undefined || isHttpOk(res.status)) &&
          res?.body?.success !== false;
        if (ok) {
          Logger.info(`[Square] On-demand refund sync accepted: ${syncValue}`);
          return syncValue;
        }
      } catch (err) {
        const msg = String(err?.message || err);
        if (/not valid Refunds|422/.test(msg)) {
          Logger.info(`[Square] Refund sync not indexed yet: ${syncValue}`);
          continue;
        }
        throw err;
      }
    }
    return null;
  } finally {
    if (prevTestCase !== undefined) process.env.testCaseName = prevTestCase;
  }
}

function buildRefundSyncCandidates(map, prefix) {
  const locationId = process.env["SQUARE_PRIMARY_STORE_DATA.LOCATION_ID"];
  const orderId = map.get(`${prefix}squareOrderId`);
  const refundId = map.get(`${prefix}squareRefundId`);
  const refundToken = map.get(`${prefix}squareRefundToken`);
  return [
    refundToken ? `${locationId}-${refundToken}` : null,
    refundId ? `${locationId}-${refundId}` : null,
    orderId && refundToken ? `${locationId}-${orderId}-${refundToken}` : null,
    orderId ? `${locationId}-${orderId}` : null,
  ].filter(Boolean);
}

/**
 * Poll until IO accepts an on-demand refund sync key (422 = refund not indexed yet).
 * Connection export often returns 401 for API tokens; we still poll for scheduled indexing.
 */
function exportPermissionError() {
  return (
    "[Square] Integrator API token cannot POST /connections/.../export (401 access_restricted). " +
    "Regenerate Integrator.token in env/E2E_Square.env with connection export permission, " +
    "then run: NODE_ENV=dev SETUP=E2E_Square node scripts/squareIoExportPreflight.js"
  );
}

async function ensureOnDemandRefundSync(data, map) {
  const prefix = resolveOrderKeyPrefix(data, "REFUND_ENSURE");
  const candidates = buildRefundSyncCandidates(map, prefix);
  const maxWaitMs = data?.request?.refundIndexMaxWaitMs ?? 180000;
  const pollMs = data?.request?.refundIndexPollMs ?? 10000;
  let exportEnabled = data?.request?.attemptExport !== false;
  const failFastOnExport401 = data?.request?.failFastOnExport401 !== false;

  const prevTestCase = process.env.testCaseName;
  const started = Date.now();
  let pass = 0;

  while (Date.now() - started < maxWaitMs) {
    pass += 1;
    if (exportEnabled) {
      const res = await postSquareConnectionExport();
      Logger.info(`[Square] Refund index pass ${pass} export status=${res?.status}`);
      if (res?.status === 401) {
        exportEnabled = false;
        if (failFastOnExport401) {
          throw new Error(exportPermissionError());
        }
        Logger.warn(
          "[Square] Connection export denied (401); relying on IO scheduled refund indexing"
        );
      }
    }
    const accepted = await probeRefundOnDemandSync(map, prefix, candidates);
    if (accepted) {
      if (prevTestCase !== undefined) process.env.testCaseName = prevTestCase;
      Logger.info(`[Square] On-demand refund sync ready after ${pass} pass(es): ${accepted}`);
      return { status: 200, body: { accepted, pass } };
    }
    Logger.info(
      `[Square] Refund not indexed yet (pass ${pass}); retry in ${pollMs / 1000}s`
    );
    await delay(pollMs);
  }

  if (prevTestCase !== undefined) process.env.testCaseName = prevTestCase;
  throw new Error(
    `[Square] Refund not indexed in IO after ${maxWaitMs}ms; tried keys: ${candidates.join(", ")}`
  );
}

/** @deprecated Use ensureOnDemandRefundSync */
async function syncSquareRefundToIo(data, map) {
  return ensureOnDemandRefundSync(data, map);
}

async function waitForSquareRefundFlowIdle(data, map) {
  const { getInQueueStatus, getInProgressStatus, getFlowID } = require("@celigo/rest-api-ia-automation/dist/src/helper/settings");
  const prefix = resolveOrderKeyPrefix(data, "REFUND_IDLE");
  const flowIdKey = `${prefix}flowId2`;
  let flowId = map.get(flowIdKey);
  const flowName =
    map.get("FLOW_NAME2") || "Square Refund to NetSuite Cash Refund [TestAccount-1 anshul]";
  if (!flowId) {
    flowId = await getFlowID(flowName);
    map.set(flowIdKey, flowId);
  }

  const maxWaitSec = data?.request?.flowIdleMaxWaitSec || 300;
  const pollSec = 3;
  let elapsed = 0;

  while (elapsed < maxWaitSec) {
    const queued = await getInQueueStatus(flowName, flowId);
    const running = await getInProgressStatus(flowName, flowId);
    if (!queued && !running) {
      Logger.info(`[Square] Refund flow idle after ${elapsed}s`);
      return { status: 200, body: { idle: true, waitedSec: elapsed } };
    }
    await delay(pollSec * 1000);
    elapsed += pollSec;
  }
  throw new Error(`[Square] Refund flow still busy after ${maxWaitSec}s`);
}

async function runSquareRefundFlowWithRetry(data, map) {
  const { apiRequest } = require("@celigo/rest-api-ia-automation/dist/src/helper/apiCalls");
  const prefix = resolveOrderKeyPrefix(data, "REFUND_RUN");
  const flowId = map.get(`${prefix}flowId2`);
  if (!flowId) throw new Error("[Square] flowId2 not found for refund flow run");

  const maxRetries = data?.request?.flowRunMaxRetries ?? 6;
  const retryDelayMs = data?.request?.flowRunRetryDelayMs ?? 10000;
  const token = global.AUTH_TOKEN;
  const baseURL = global.baseURL;
  const contentType = global.CONTENT_TYPE;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await apiRequest("POST", baseURL, `/flows/${flowId}/run`, token, contentType);
    const status = res?.status;
    if (status >= 200 && status < 300) {
      Logger.info(`[Square] Refund flow run accepted (attempt ${attempt}/${maxRetries})`);
      return res;
    }
    const body = res?.text || JSON.stringify(res?.body || {});
    if (status === 409 && /job_already_queued/.test(body) && attempt < maxRetries) {
      await delay(retryDelayMs);
      await waitForSquareRefundFlowIdle(data, map);
      continue;
    }
    throw new Error(`[Square] Refund flow run failed status=${status}: ${body}`);
  }
  throw new Error(`[Square] Refund flow run failed after ${maxRetries} attempts`);
}

async function createSquareOrderFromPayload(data, map) {
  let scenario = "SINGLE_LINE_BASE";
  const payloadPath = data?.request?.payload;
  if (typeof payloadPath === "string" && payloadPath.endsWith(".json")) {
    try {
      const fs = require("fs");
      const path = require("path");
      const full = path.join(process.env.PWD || ".", payloadPath.replace(/^\//, ""));
      const json = JSON.parse(fs.readFileSync(full, "utf8"));
      if (json.scenario) scenario = json.scenario;
    } catch (e) {
      Logger.warn(`[Square] Could not read scenario from payload: ${e.message}`);
    }
  }
  const prefix = resolveOrderKeyPrefix(data, scenario);
  return createOrderForScenario(scenario, map, prefix);
}

const squareDataCreationHandlers = {
  createSquareOrderSC1,
  createSquareOrderFromPayload,
  waitForSquareOrderFlowIdle,
  createSquareOrderFiveOnDemand: createFiveOrdersOnDemand,
  createSquareOrderOrderDiscount25: makeScenarioHandler("ORDER_DISCOUNT_25"),
  createSquareOrderLineDiscount25: makeScenarioHandler("LINE_DISCOUNT_25"),
  createSquareOrderLineAndCartDiscount: makeScenarioHandler("LINE_AND_CART_DISCOUNT"),
  createSquareOrderTipLineLevel: makeScenarioHandler("TIP_LINE_LEVEL"),
  createSquareOrderLineDiscountTip: makeScenarioHandler("LINE_DISCOUNT_TIP"),
  createSquareOrderOrderDiscountTip: makeScenarioHandler("ORDER_DISCOUNT_TIP"),
  createSquareOrderTwoLineTaxable: makeScenarioHandler("TWO_LINE_TAXABLE"),
  createSquareOrderSingleLineBase: makeScenarioHandler("SINGLE_LINE_BASE"),
  createSquareOrderRoundPriceUp: makeScenarioHandler("ROUND_PRICE_UP"),
  createSquareOrderRoundPriceDown: makeScenarioHandler("ROUND_PRICE_DOWN"),
  createSquareOrderMultiQtySingle: makeScenarioHandler("MULTI_QTY_SINGLE"),
  createSquareOrderThreeLine: makeScenarioHandler("THREE_LINE"),
  createSquareOrderCustomAmountPlusItem: makeScenarioHandler("CUSTOM_AMOUNT_PLUS_ITEM"),
  createSquareOrderCartDiscount15: makeScenarioHandler("CART_DISCOUNT_15"),
  createSquareOrderLineDiscTwoLine: makeScenarioHandler("LINE_DISC_TWO_LINE"),
  createSquareOrderTipTwoLine: makeScenarioHandler("TIP_TWO_LINE"),
  createSquareOrderTipLarge: makeScenarioHandler("TIP_LARGE"),
  createSquareOrderLineDiscMultiQty: makeScenarioHandler("LINE_DISC_MULTI_QTY"),
  createSquareOrderTwoLineMultiQty: makeScenarioHandler("TWO_LINE_MULTI_QTY"),
  createSquareOrderOrderDiscTwoLine: makeScenarioHandler("ORDER_DISC_TWO_LINE"),
  createSquareOrderCartDiscTip: makeScenarioHandler("CART_DISC_TIP"),
  createSquareOrderLineCartTip: makeScenarioHandler("LINE_CART_TIP"),
  createSquareOrderSingleLineModifier: makeScenarioHandler("SINGLE_LINE_MODIFIER"),
  createSquareOrderSingleLineModifierMultiQty: makeScenarioHandler("SINGLE_LINE_MODIFIER_MULTI_QTY"),
  createSquareOrderSingleLineModifierTip: makeScenarioHandler("SINGLE_LINE_MODIFIER_TIP"),
  createSquareOrderTwoLineOneModifier: makeScenarioHandler("TWO_LINE_ONE_MODIFIER"),
  createSquareOrderCustomerThreeLine: makeScenarioHandler("CUSTOMER_THREE_LINE"),
  createSquareOrderNewCustomerTwoLine: makeScenarioHandler("NEW_CUSTOMER_TWO_LINE"),
  createSquareOrderDecimalQtySingle: makeScenarioHandler("DECIMAL_QTY_SINGLE"),
  createSquareOrderModifierLineDiscount: makeScenarioHandler("MODIFIER_LINE_DISCOUNT"),
  createSquareOrderElevenOnDemand: createElevenOrdersOnDemand,
  createSquareOrderTenOnDemand: createTenOrdersOnDemand,
  createSquareOrderTenModifierOnDemand: createTenOrdersModifierOnDemand,
  createSquareOrderValidInvalidOnDemand: createValidInvalidOnDemand,
  createSquareOrderMultiPayment: makeScenarioHandler("MULTI_PAYMENT_CASH_CHECK"),
  createSquareOrderUnknownSku: makeScenarioHandler("UNKNOWN_SKU_LINE"),
  createSquareOrderZeroDollar: makeScenarioHandler("ZERO_DOLLAR_ORDER"),
  createSquareOrderTwoLineEachModifier: makeScenarioHandler("TWO_LINE_EACH_MODIFIER"),
  createSquareOrderSingleLineMultiModifier: makeScenarioHandler("SINGLE_LINE_MULTI_MODIFIER"),
  createSquareOrderTwoLineEachOneModifier: makeScenarioHandler("TWO_LINE_EACH_ONE_MODIFIER"),
  createSquareOrderModifierCartDiscount: makeScenarioHandler("MODIFIER_CART_DISCOUNT"),
  createSquareOrderModifierLineItemSetting: makeScenarioHandler("MODIFIER_LINE_ITEM_SETTING"),
  createSquareOrderModifierAdjustSetting: makeScenarioHandler("MODIFIER_ADJUST_SETTING"),
  createSquareOrderGiftCardPartial: makeScenarioHandler("GIFT_CARD_PARTIAL"),
  createSquareOrderGiftCardFull: makeScenarioHandler("GIFT_CARD_FULL"),
  createSquareOrderGiftCardPartialTip: makeScenarioHandler("GIFT_CARD_PARTIAL_TIP"),
  createSquareOrderModifierGiftCard: makeScenarioHandler("MODIFIER_GIFT_CARD"),
  createSquareOrderSerialSingle: makeScenarioHandler("SERIAL_SINGLE"),
  createSquareOrderSerialMulti: makeScenarioHandler("SERIAL_MULTI"),
  createSquareOrderLotSingle: makeScenarioHandler("LOT_SINGLE"),
  createSquareOrderLotMulti: makeScenarioHandler("LOT_MULTI"),
  createSquareOrderMixedInvSerialLot: makeScenarioHandler("MIXED_INV_SERIAL_LOT"),
  createSquareOrderMixedInvSerialLotSingle: makeScenarioHandler("MIXED_INV_SERIAL_LOT_SINGLE"),
  createSquareOrderLotSerialTip: makeScenarioHandler("LOT_SERIAL_TIP"),
  createSquareOrderLotSerialDiscount: makeScenarioHandler("LOT_SERIAL_DISCOUNT"),
  createSquareOrderTwoLotSingle: makeScenarioHandler("TWO_LOT_SINGLE"),
  createSquareOrderTwoSerialMulti: makeScenarioHandler("TWO_SERIAL_MULTI"),
  createSquareOrderTwoSerialSingle: makeScenarioHandler("TWO_SERIAL_SINGLE"),
  squareStaticDelay,
  runSquareOrderFlowWithRetry,
  createSquareOrderPartialQtyMulti: makeScenarioHandler("PARTIAL_QTY_MULTI"),
  createSquareOrderTaxSingleLine: makeScenarioHandler("TAX_SINGLE_LINE"),
  createSquareOrderExistingCustomerSingle: makeScenarioHandler("EXISTING_CUSTOMER_SINGLE"),
  createSquareOrderNewCustomerSingle: makeScenarioHandler("NEW_CUSTOMER_SINGLE"),
  createSquareOrderNewCustomerNoEmail: makeScenarioHandler("NEW_CUSTOMER_NO_EMAIL"),
  createSquareOrderTipVarianceCheck: makeScenarioHandler("TIP_VARIANCE_CHECK"),
  createSquareReturnOrder,
  createSquareRefund,
  ensureOnDemandRefundSync,
  syncSquareRefundToIo,
  waitForSquareRefundFlowIdle,
  runSquareRefundFlowWithRetry,
};

module.exports = {
  squareDataCreationHandlers,
  createSquareOrderSC1,
  createOrderForScenario,
  waitForSquareOrderFlowIdle,
  runSquareOrderFlowWithRetry,
  squareStaticDelay,
  SCENARIOS,
};
