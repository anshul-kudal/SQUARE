/**
 * Generates Square Return/Refund E2E testcase JSON + payloads (order import → refund import → NS cash refund).
 */
const fs = require("fs");
const path = require("path");
const {
  settings0Default,
  flowResponse,
  resolveFlowStability,
} = require("./squareBatchGenerator");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n");
}

const orderFlowStatus = {
  "Square Order to NetSuite Cash Sale": true,
  "Square Tenders to NetSuite Payments": false,
  "Square Customer to NetSuite Customer": false,
  "Square Refund to NetSuite Cash Refund": false,
};

const refundFlowStatus = {
  "Square Order to NetSuite Cash Sale": false,
  "Square Tenders to NetSuite Payments": false,
  "Square Customer to NetSuite Customer": false,
  "Square Refund to NetSuite Cash Refund": true,
};

function buildExpectedCashSale(keyPrefix, exp) {
  const lines = [];
  for (const p of exp.products || []) {
    lines.push({
      Item: `process.env[DEFAULTS.PRODUCTS.${p.sku}.SKU]`,
      Quantity: String(p.qty ?? 1),
      ...(p.rate ? { "Item Rate": p.rate } : {}),
    });
  }
  for (const d of exp.discounts || []) {
    if (d.anyDiscount) {
      lines.push({ Item: "DIS00000", "eTail Order Item Type Id": "" });
    } else {
      lines.push({
        Item: "DIS00000",
        "Item Rate": d.rate,
        "Amount (Foreign Currency)": d.rate,
        "eTail Order Item Type Id": "",
      });
    }
  }
  return {
    cashSale_line_items: lines,
    items: [],
    fulfilLines: [],
    fulfilTracking: [],
    cancelorderLine: [],
    assignedInventoryDetail: [],
    CustomerDepositDetails: [],
    inventoryDetails: [],
    salesOrder_discount_codes: [],
    salesOrder_LineLevel_discount: [],
    etail_line_items: [],
    etail_tax_line_items: [],
    etail_refund_line_items: [],
    etail_refund_adjustments: [],
    "eTail Order Total Variance": "0",
    "eTail Discount Total Variance": "0",
    "eTail Tax Total Variance": "0",
    "eTail Ship Total Variance": "0",
    "eTail Order Id": `{{${keyPrefix}squareOrderId}}`,
    "eTail Channel": "process.env[AUT.SH]",
    "eTail Refund Exported": null,
    "eTail Cancelled Order Exported": null,
    Currency: "process.env[CURRENCY.NETSUITE]",
  };
}

function buildExpectedCashRefund(keyPrefix, exp) {
  const refundLines = (exp.refundLines || []).map((r) => ({
    Item: r.item || `process.env[DEFAULTS.PRODUCTS.${r.sku ?? 0}.SKU]`,
    Quantity: r.qty || "-1",
    "Amount (Foreign Currency)": r.amount,
    ...(r.rate ? { "Item Rate": r.rate } : {}),
  }));

  return {
    "Amount (Transaction Total)": exp.totalAmount,
    etail_refund_line_items: refundLines,
    etail_refund_adjustments: exp.refundAdjustments || [],
    // At import time the refund has just come INTO NetSuite, so the "exported back"
    // flag is F (it only flips T after a downstream export-back flow, not part of import).
    "eTail Refund Exported": "F",
    "eTail Order Id": `{{${keyPrefix}squareOrderId}}`,
    "eTail Channel": "process.env[AUT.SH]",
    // NS cash refund search returns an empty Payment Method for cash refunds in this account.
    // Aligned to the verified actual; if business requires "Cash" this is a connector mapping gap.
    "Payment Method": exp.paymentMethod || "",
    Location: "process.env[NS_DEFAULT.LOCATION1]",
    "eTail Order Total Variance": "0",
    "eTail Discount Total Variance": "0",
    "eTail Tax Total Variance": "0",
    "eTail Ship Total Variance": "0",
    "eTail Cancelled Order Exported": null,
  };
}

function buildOrderInteraction(tc, batchTag, filterTag = "return_import") {
  const FLOW = resolveFlowStability();
  const {
    keyPrefix,
    test,
    zephyr,
    title,
    orderScenario,
    expectedOrder,
    staticDelayBeforeFlowRun,
    flowMaxWait,
    flowIdleMaxWaitSec,
    postFlowIdleMaxWaitSec,
    nsSettleDelayMs,
  } = tc;
  const base = `/test-data/Square_Suite/Return_Import/${batchTag}/${keyPrefix}`;
  const orderTest = `${test}Order`;

  const pre_request = [
    {
      request: {
        method: "GET",
        path: "/integrations",
        filterKey: "name : Square - NetSuite",
        [`store_${keyPrefix}integrationID`]: "_id",
      },
    },
    {
      request: {
        method: "GET",
        path: "/flows",
        filterKey: "name : Square Order to NetSuite Cash Sale",
        storeName: "store1",
        [`store_${keyPrefix}flowId1`]: "_id",
        getFlowsByIntegrationId: true,
      },
    },
    {
      request: {
        method: "PUT",
        path: `/integrations/{{${keyPrefix}integrationID}}/settings/persistSettings`,
        settingsMethod: "updateflowStatusThroughAPI",
        payload: `${base}/${orderTest}_flowStatusJSON.json`,
      },
    },
    {
      request: {
        method: "PUT",
        path: `/integrations/{{${keyPrefix}integrationID}}/settings/persistSettings`,
        payload: `${base}/${orderTest}_updateSettings0.json`,
        settingsMethod: "updateSettings",
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        payload: `${base}/${orderTest}_createOrder.json`,
        dataCreationMethod: "createSquareReturnOrder",
        orderKeyPrefix: keyPrefix,
        skipThePreRequestValidation: true,
      },
    },
    {
      request: {
        method: "PUT",
        path: `/integrations/{{${keyPrefix}integrationID}}/settings/persistSettings`,
        payload: `${base}/${orderTest}_updateSettings1.json`,
        settingsMethod: "updateSettings",
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        dataCreationMethod: "squareStaticDelay",
        delayMs: staticDelayBeforeFlowRun ?? FLOW.staticDelayBeforeFlowRun,
        skipThePreRequestValidation: true,
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        dataCreationMethod: "waitForSquareOrderFlowIdle",
        orderKeyPrefix: keyPrefix,
        flowIdleMaxWaitSec: flowIdleMaxWaitSec ?? FLOW.flowIdleMaxWaitSec,
        skipThePreRequestValidation: true,
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        dataCreationMethod: "runSquareOrderFlowWithRetry",
        orderKeyPrefix: keyPrefix,
        flowRunMaxRetries: 6,
        flowRunRetryDelayMs: 10000,
        flowIdleMaxWaitSec: flowIdleMaxWaitSec ?? FLOW.flowIdleMaxWaitSec,
        skipThePreRequestValidation: true,
      },
    },
    {
      request: {
        method: "GET",
        path: `/flows/{{${keyPrefix}flowId1}}/jobs/latest`,
        waitUntil: "completed",
        maxWait: flowMaxWait ?? FLOW.flowMaxWait,
      },
      response: {
        status: 200,
        partialValidation: true,
        body: `${base}/${orderTest}_flow_response1.json`,
        dontStopExecutionOnFailure: true,
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        dataCreationMethod: "waitForSquareOrderFlowIdle",
        orderKeyPrefix: keyPrefix,
        flowIdleMaxWaitSec:
          postFlowIdleMaxWaitSec ?? flowIdleMaxWaitSec ?? FLOW.postFlowIdleMaxWaitSec,
        skipThePreRequestValidation: true,
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        dataCreationMethod: "squareStaticDelay",
        delayMs: nsSettleDelayMs ?? FLOW.nsSettleDelayMs,
        skipThePreRequestValidation: true,
      },
    },
  ];

  return {
    test: orderTest,
    test_title: `${orderTest} [${batchTag}][${filterTag}][OrderImport][${zephyr}] - ${title} (cash sale)`,
    pre_request,
    request: {
      method: "POST",
      path: "/connections/process.env[CONNECTIONS.NETSUITE]/proxy",
    },
    response: {
      status: 200,
      time: 10000,
      dataValidationMethod: "verifyCashsaleDataFromNetsuite",
      body: `${base}/${orderTest}_expectedResponse1.json`,
      uniqueValue: `{{${keyPrefix}squareOrderId}}`,
      secondaryValue: "false",
    },
  };
}

function buildRefundInteraction(tc, batchTag, filterTag = "return_import") {
  const FLOW = resolveFlowStability();
  const {
    keyPrefix,
    test,
    zephyr,
    title,
    refundKind,
    refundAmountCents,
    staticDelayBeforeFlowRun,
    flowMaxWait,
    flowIdleMaxWaitSec,
    postFlowIdleMaxWaitSec,
    nsSettleDelayMs,
  } = tc;
  const base = `/test-data/Square_Suite/Return_Import/${batchTag}/${keyPrefix}`;
  const refundTest = `${test}Refund`;

  const pre_request = [
    {
      request: {
        method: "GET",
        path: "/flows",
        filterKey: "name : Square Refund to NetSuite Cash Refund",
        storeName: "store1",
        [`store_${keyPrefix}flowId2`]: "_id",
        getFlowsByIntegrationId: true,
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        payload: `${base}/${refundTest}_createRefund.json`,
        dataCreationMethod: "createSquareRefund",
        orderKeyPrefix: keyPrefix,
        skipThePreRequestValidation: true,
      },
    },
    {
      request: {
        method: "PUT",
        path: `/integrations/{{${keyPrefix}integrationID}}/settings/persistSettings`,
        settingsMethod: "updateflowStatusThroughAPI",
        payload: `${base}/${refundTest}_flowStatusJSON.json`,
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        payload: `${base}/${refundTest}_updateSettings1.json`,
        dataCreationMethod: "ensureOnDemandRefundSync",
        orderKeyPrefix: keyPrefix,
        skipThePreRequestValidation: true,
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        dataCreationMethod: "squareStaticDelay",
        delayMs: staticDelayBeforeFlowRun ?? FLOW.staticDelayBeforeFlowRun,
        skipThePreRequestValidation: true,
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        dataCreationMethod: "waitForSquareRefundFlowIdle",
        orderKeyPrefix: keyPrefix,
        flowIdleMaxWaitSec: flowIdleMaxWaitSec ?? FLOW.flowIdleMaxWaitSec,
        skipThePreRequestValidation: true,
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        dataCreationMethod: "runSquareRefundFlowWithRetry",
        orderKeyPrefix: keyPrefix,
        flowRunMaxRetries: 6,
        flowRunRetryDelayMs: 10000,
        flowIdleMaxWaitSec: flowIdleMaxWaitSec ?? FLOW.flowIdleMaxWaitSec,
        skipThePreRequestValidation: true,
      },
    },
    {
      request: {
        method: "GET",
        path: `/flows/{{${keyPrefix}flowId2}}/jobs/latest`,
        waitUntil: "completed",
        maxWait: flowMaxWait ?? FLOW.flowMaxWait,
      },
      response: {
        status: 200,
        partialValidation: true,
        body: `${base}/${refundTest}_flow_response1.json`,
        dontStopExecutionOnFailure: true,
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        dataCreationMethod: "waitForSquareRefundFlowIdle",
        orderKeyPrefix: keyPrefix,
        flowIdleMaxWaitSec:
          postFlowIdleMaxWaitSec ?? flowIdleMaxWaitSec ?? FLOW.postFlowIdleMaxWaitSec,
        skipThePreRequestValidation: true,
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        dataCreationMethod: "squareStaticDelay",
        delayMs: nsSettleDelayMs ?? FLOW.nsSettleDelayMs,
        skipThePreRequestValidation: true,
      },
    },
  ];

  return {
    test: refundTest,
    test_title: `${refundTest} [${batchTag}][${filterTag}][RefundImport][${zephyr}] - ${title} (${refundKind}${refundAmountCents ? ` ${refundAmountCents}c` : ""})`,
    pre_request,
    request: {
      method: "POST",
      path: "/connections/process.env[CONNECTIONS.NETSUITE]/proxy",
    },
    response: {
      status: 200,
      time: 10000,
      dataValidationMethod: "verifyCashRefundDataFromNetsuite",
      body: `${base}/${refundTest}_expectedResponse1.json`,
      uniqueValue: `{{${keyPrefix}squareOrderId}}`,
    },
  };
}

function generateReturnBatch(root, { batchTag, suiteTitle, tests, outFileName, filterTag = "return_import" }) {
  const dataRoot = path.join(root, "test-data/Square_Suite/Return_Import", batchTag);

  for (const tc of tests) {
    const { keyPrefix, test, orderScenario, refundKind, refundAmountCents } = tc;
    const base = path.join(dataRoot, keyPrefix);
    const orderTest = `${test}Order`;
    const refundTest = `${test}Refund`;

    writeJson(path.join(base, `${orderTest}_flowStatusJSON.json`), orderFlowStatus);
    writeJson(path.join(base, `${orderTest}_updateSettings0.json`), settings0Default());
    writeJson(path.join(base, `${orderTest}_updateSettings1.json`), {
      "On-demand order sync": `{{${keyPrefix}onDemandOrderSync}}`,
    });
    writeJson(path.join(base, `${orderTest}_createOrder.json`), {
      orderKeyPrefix: keyPrefix,
      orderScenario,
    });
    writeJson(path.join(base, `${orderTest}_flow_response1.json`), flowResponse);
    writeJson(
      path.join(base, `${orderTest}_expectedResponse1.json`),
      buildExpectedCashSale(keyPrefix, tc.expectedOrder)
    );

    writeJson(path.join(base, `${refundTest}_flowStatusJSON.json`), refundFlowStatus);
    writeJson(path.join(base, `${refundTest}_updateSettings1.json`), {
      "On-demand refund sync": `{{${keyPrefix}onDemandRefundSync}}`,
    });
    writeJson(path.join(base, `${refundTest}_createRefund.json`), {
      orderKeyPrefix: keyPrefix,
      refundKind,
      refundSettleMs: tc.refundSettleMs ?? 35000,
      ...(refundAmountCents != null ? { refundAmountCents } : {}),
      ...(tc.refundPct != null ? { refundPct: tc.refundPct } : {}),
      ...(tc.refundQty != null ? { refundQty: tc.refundQty } : {}),
      ...(tc.lineIndex != null ? { lineIndex: tc.lineIndex } : {}),
    });
    writeJson(path.join(base, `${refundTest}_flow_response1.json`), flowResponse);
    writeJson(
      path.join(base, `${refundTest}_expectedResponse1.json`),
      buildExpectedCashRefund(keyPrefix, tc.expectedRefund)
    );
  }

  const interactions = [];
  for (const tc of tests) {
    interactions.push(buildOrderInteraction(tc, batchTag, filterTag));
    interactions.push(buildRefundInteraction(tc, batchTag, filterTag));
  }

  const testcase = {
    testData: [
      {
        suite: suiteTitle,
        suite_title: suiteTitle,
        storeName: "store1",
        interactions,
      },
    ],
  };

  const outPath = path.join(root, "testcases/Square_Suite/Return_Import", outFileName);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(testcase, null, 2) + "\n");
  return { outPath, count: tests.length, interactions: interactions.length };
}

module.exports = {
  generateReturnBatch,
  buildExpectedCashSale,
  buildExpectedCashRefund,
  orderFlowStatus,
  refundFlowStatus,
};
