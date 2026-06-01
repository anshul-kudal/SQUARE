/**
 * Shared helpers for generating Square Order Import batch testcase files.
 */
const fs = require("fs");
const path = require("path");

const flowStatus = {
  "Square Order to NetSuite Cash Sale": true,
  "Square Tenders to NetSuite Payments": false,
  "Square Customer to NetSuite Customer": false,
};

const flowResponse = {
  status: "completed",
  numSuccess: 2,
  numError: 0,
  numResolved: 0,
  numOpenError: 0,
  numIgnore: 0,
  numExport: 0,
  numPagesProcessed: 0,
  numPagesWithErrors: 0,
};

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, obj) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n");
}

function buildExpected(keyPrefix, exp) {
  const cashSaleLines = [];
  for (const p of exp.products || []) {
    const line = {
      Item: `process.env[DEFAULTS.PRODUCTS.${p.sku}.SKU]`,
      Quantity: String(p.qty ?? 1),
    };
    if (p.rate) line["Item Rate"] = p.rate;
    cashSaleLines.push(line);
  }
  for (const d of exp.discounts || []) {
    if (d.anyDiscount) {
      cashSaleLines.push({ Item: "DIS00000", "eTail Order Item Type Id": "" });
    } else {
      cashSaleLines.push({
        Item: "DIS00000",
        "Item Rate": d.rate,
        "Amount (Foreign Currency)": d.rate,
        "eTail Order Item Type Id": "",
      });
    }
  }

  const variances = exp.requireZeroVariance !== false
    ? { "eTail Order Total Variance": "0", "eTail Discount Total Variance": "0", "eTail Tax Total Variance": "0", "eTail Ship Total Variance": "0" }
    : {};

  return {
    items: [],
    fulfilLines: [],
    fulfilTracking: [],
    cancelorderLine: [],
    assignedInventoryDetail: [],
    cashSale_line_items: cashSaleLines,
    CustomerDepositDetails: [],
    inventoryDetails: [],
    salesOrder_discount_codes: [],
    salesOrder_LineLevel_discount: [],
    etail_line_items: [],
    etail_tax_line_items: [],
    etail_refund_line_items: [],
    etail_refund_adjustments: [],
    ...variances,
    "eTail Order Id": `{{${keyPrefix}squareOrderId}}`,
    "eTail Channel": "process.env[AUT.SH]",
    "eTail Refund Exported": null,
    "eTail Cancelled Order Exported": null,
    Currency: "process.env[CURRENCY.NETSUITE]",
  };
}

const flowResponseError = {
  status: "completed",
  numSuccess: 0,
  numError: 1,
  numResolved: 0,
  numOpenError: 0,
  numIgnore: 0,
  numExport: 0,
  numPagesProcessed: 0,
  numPagesWithErrors: 0,
};

/** Flow stability profiles — quick tuned for full-suite (no 409s observed at 120s idle). */
const FLOW_PROFILES = {
  default: {
    flowMaxWait: 10,
    flowIdleMaxWaitSec: 600,
    postFlowIdleMaxWaitSec: 120,
    staticDelayBeforeFlowRun: 30000,
    flowRunWithRetry: true,
    nsSettleDelayMs: 8000,
  },
  quick: {
    flowMaxWait: 8,
    flowIdleMaxWaitSec: 120,
    postFlowIdleMaxWaitSec: 30,
    staticDelayBeforeFlowRun: 10000,
    flowRunWithRetry: true,
    nsSettleDelayMs: 5000,
  },
};

function resolveFlowStability() {
  const profile = process.env.SQUARE_FLOW_PROFILE
    || (process.env.SQUARE_QUICK === "1" ? "quick" : "default");
  return FLOW_PROFILES[profile] || FLOW_PROFILES.default;
}

function buildInteraction(tc, batchTag, batchNum) {
  const FLOW_STABILITY = resolveFlowStability();
  const {
    keyPrefix,
    test,
    zephyr,
    title,
    dataCreationMethod,
    validateOrderKey,
    skipNsValidation,
    skipFlowRun,
    settingsValidate,
    staticDelayBeforeFlowRun,
    flowMaxWait,
    flowIdleMaxWaitSec,
    postFlowIdleMaxWaitSec,
    waitAfterOnDemandSync,
    flowRunWithRetry,
    nsSettleDelayMs,
  } = tc;
  const base = `/test-data/Square_Suite/Order_Import/Batch${batchNum}/${keyPrefix}`;
  const orderKey = validateOrderKey || keyPrefix;
  const orderImportTag = tc.orderImportTag !== false ? "[OrderImport]" : "";

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
        payload: `${base}/${test}_flowStatusJSON.json`,
      },
    },
    {
      request: {
        method: "PUT",
        path: `/integrations/{{${keyPrefix}integrationID}}/settings/persistSettings`,
        payload: `${base}/${test}_updateSettings0.json`,
        settingsMethod: "updateSettings",
      },
    },
    {
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        payload: `${base}/${test}_createOrder.json`,
        dataCreationMethod,
        orderKeyPrefix: keyPrefix,
        skipThePreRequestValidation: true,
      },
    },
    {
      request: {
        method: "PUT",
        path: `/integrations/{{${keyPrefix}integrationID}}/settings/persistSettings`,
        payload: `${base}/${test}_updateSettings1.json`,
        settingsMethod: "updateSettings",
      },
    },
  ];

  if (settingsValidate) {
    pre_request.push({
      request: {
        method: "PUT",
        path: `/integrations/{{${keyPrefix}integrationID}}/settings/persistSettings`,
        payload: `${base}/${test}_updateSettingsValidate.json`,
        settingsMethod: "updateSettings",
        skipThePreRequestValidation: true,
      },
      response: {
        status: settingsValidate.status || 422,
        ...(settingsValidate.bodyFile
          ? { body: `${base}/${test}_settingsValidate_response.json` }
          : {}),
      },
    });
  }

  if (!skipFlowRun) {
    if (waitAfterOnDemandSync) {
      pre_request.push({
        request: {
          method: "POST",
          path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
          dataCreationMethod: "waitForSquareOrderFlowIdle",
          orderKeyPrefix: keyPrefix,
          flowIdleMaxWaitSec: flowIdleMaxWaitSec ?? FLOW_STABILITY.flowIdleMaxWaitSec,
          skipThePreRequestValidation: true,
        },
      });
    }
    if (staticDelayBeforeFlowRun !== false) {
      pre_request.push({
        request: {
          method: "POST",
          path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
          dataCreationMethod: "squareStaticDelay",
          delayMs: staticDelayBeforeFlowRun ?? FLOW_STABILITY.staticDelayBeforeFlowRun,
          skipThePreRequestValidation: true,
        },
      });
    }
    pre_request.push({
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        dataCreationMethod: "waitForSquareOrderFlowIdle",
        orderKeyPrefix: keyPrefix,
        flowIdleMaxWaitSec: flowIdleMaxWaitSec ?? FLOW_STABILITY.flowIdleMaxWaitSec,
        skipThePreRequestValidation: true,
      },
    });
    if (flowRunWithRetry !== false) {
      pre_request.push({
        request: {
          method: "POST",
          path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
          dataCreationMethod: "runSquareOrderFlowWithRetry",
          orderKeyPrefix: keyPrefix,
          flowRunMaxRetries: 6,
          flowRunRetryDelayMs: 10000,
          flowIdleMaxWaitSec: flowIdleMaxWaitSec ?? FLOW_STABILITY.flowIdleMaxWaitSec,
          skipThePreRequestValidation: true,
        },
      });
    } else {
      pre_request.push({
        request: {
          method: "POST",
          path: `/flows/{{${keyPrefix}flowId1}}/run`,
        },
      });
    }
    pre_request.push({
      request: {
        method: "GET",
        path: `/flows/{{${keyPrefix}flowId1}}/jobs/latest`,
        waitUntil: "completed",
        maxWait: flowMaxWait ?? FLOW_STABILITY.flowMaxWait,
      },
      response: {
        status: 200,
        partialValidation: true,
        body: `${base}/${test}_flow_response1.json`,
        dontStopExecutionOnFailure: true,
      },
    });
    pre_request.push({
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        dataCreationMethod: "waitForSquareOrderFlowIdle",
        orderKeyPrefix: keyPrefix,
        flowIdleMaxWaitSec:
          postFlowIdleMaxWaitSec ??
          flowIdleMaxWaitSec ??
          FLOW_STABILITY.postFlowIdleMaxWaitSec,
        skipThePreRequestValidation: true,
      },
    });
  }

  if (!skipNsValidation && !skipFlowRun) {
    pre_request.push({
      request: {
        method: "POST",
        path: "/connections/process.env[CONNECTIONS.SQUARE]/export",
        dataCreationMethod: "squareStaticDelay",
        delayMs: nsSettleDelayMs ?? FLOW_STABILITY.nsSettleDelayMs,
        skipThePreRequestValidation: true,
      },
    });
  }

  return {
    test,
    test_title: `${test} [${batchTag}]${orderImportTag}[${zephyr}] - ${title}`,
    pre_request,
    request: skipNsValidation
      ? {
          method: "GET",
          path: `/integrations/{{${keyPrefix}integrationID}}`,
        }
      : {
          method: "POST",
          path: "/connections/process.env[CONNECTIONS.NETSUITE]/proxy",
        },
    response: skipNsValidation
      ? { status: 200, time: 5000 }
      : {
          status: 200,
          time: 10000,
          dataValidationMethod: "verifyCashsaleDataFromNetsuite",
          body: `${base}/${test}_expectedResponse1.json`,
          uniqueValue: `{{${orderKey}squareOrderId}}`,
          secondaryValue: "false",
        },
  };
}

function generateBatch(root, { batchNum, batchTag, suiteTitle, tests, outFileName }) {
  for (const tc of tests) {
    const { keyPrefix, test } = tc;
    const base = path.join(root, "test-data/Square_Suite/Order_Import", `Batch${batchNum}`, keyPrefix);

    writeJson(path.join(base, `${test}_flowStatusJSON.json`), tc.flowStatus || flowStatus);
    writeJson(
      path.join(base, `${test}_updateSettings0.json`),
      tc.settings0 || settings0Default()
    );
    writeJson(
      path.join(base, `${test}_updateSettings1.json`),
      tc.settings1 || { "On-demand order sync": `{{${keyPrefix}onDemandOrderSync}}` }
    );
    if (tc.settingsValidate) {
      writeJson(path.join(base, `${test}_updateSettingsValidate.json`), tc.settingsValidate.payload || {});
      if (tc.settingsValidate.bodyFile) {
        writeJson(path.join(base, `${test}_settingsValidate_response.json`), tc.settingsValidate.bodyFile);
      }
    }
    writeJson(path.join(base, `${test}_createOrder.json`), { orderKeyPrefix: keyPrefix, ...(tc.createOrder || {}) });
    writeJson(path.join(base, `${test}_flow_response1.json`), tc.flowResponse || flowResponse);
    if (!tc.skipNsValidation) {
      writeJson(path.join(base, `${test}_expectedResponse1.json`), buildExpected(keyPrefix, tc.expected));
    }
  }

  const testcase = {
    testData: [
      {
        suite: suiteTitle,
        suite_title: suiteTitle,
        storeName: "store1",
        interactions: tests.map((tc) => buildInteraction(tc, batchTag, batchNum)),
      },
    ],
  };

  const outPath = path.join(
    root,
    "testcases/Square_Suite/Order_Import",
    outFileName || `Batch${batchNum}_OrderImport.json`
  );
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(testcase, null, 2) + "\n");
  return { outPath, count: tests.length };
}

function settings0Default(extra = {}) {
  return {
    "Default NetSuite customer if missing on Square order": "process.env[DEFAULT_CUSTOMER.ID]",
    ...extra,
  };
}

module.exports = {
  generateBatch,
  buildExpected,
  settings0Default,
  flowStatus,
  flowResponse,
  flowResponseError,
  FLOW_PROFILES,
  resolveFlowStability,
};
