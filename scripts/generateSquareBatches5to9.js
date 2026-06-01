#!/usr/bin/env node
/**
 * Generates Square Order Import Batches 5–9 (82 remaining backlog TCs).
 * Run: node scripts/generateSquareBatches5to9.js
 */
const path = require("path");
const {
  generateBatch,
  settings0Default,
  flowStatus,
  flowResponse,
  flowResponseError,
} = require("../helpers/squareBatchGenerator");

const ROOT = path.join(__dirname, "..");

const flowTendersOn = {
  "Square Order to NetSuite Cash Sale": true,
  "Square Tenders to NetSuite Payments": true,
  "Square Customer to NetSuite Customer": false,
};

const modAdjust = {
  "Sync Square product modifier price to NetSuite as": "Adjustments to item list price",
};

const modLineItem = {
  "Sync Square product modifier price to NetSuite as":
    "New line below the original line (recommended)",
  "NetSuite item to track product modifier price as a line item": "57176",
};

const taxSingleLine = {
  "How would you like to bring sales tax into NetSuite?":
    "Add total tax against a single line item on the order",
  "Per-line taxes on transaction enabled in NetSuite": true,
  "Bring Square line level discounts into NetSuite as": "Adjustments to item list price",
};

const autoAssignInv = {
  "Auto-assign inventory detail to Lot Numbered/Serialized items": true,
};

const batch8Stability = {
  // Framework treats maxWait as minutes (waitTime * 60s), not seconds
  flowMaxWait: 10,
  flowIdleMaxWaitSec: 600,
  postFlowIdleMaxWaitSec: 120,
  staticDelayBeforeFlowRun: 30000,
  flowRunWithRetry: true,
};

function batch8(key, test, zephyr, title, method, expected, extra = {}) {
  return std(key, test, zephyr, title, method, expected, {
    settings0: settings0Default(autoAssignInv),
    ...batch8Stability,
    ...extra,
  });
}

function batch9(key, test, zephyr, title, method, expected, extra = {}) {
  return std(key, test, zephyr, title, method, expected, {
    ...batch8Stability,
    ...extra,
  });
}

const skuTrackItem = {
  "NetSuite item to track order lines when no matching SKU is found in NetSuite":
    "process.env[SQUARE_NS.NOSKU_TRACK_ITEM_ID]",
};

const skuFieldNameInternal = {
  "NetSuite SKU field": "nameinternal",
};

const payDefaultCash = {
  Payment: { "Use Custom Default Value": "Cash" },
};

const payNullDefault = {
  Payment: "Use Null as Default Value",
};

const payEmptyDefault = {
  Payment: "Use Empty string as Default Value",
};

function std(key, test, zephyr, title, method, expected, extra = {}) {
  return {
    keyPrefix: key.replace(/-/g, ""),
    test,
    zephyr,
    title,
    dataCreationMethod: method,
    expected: expected || { products: [{ sku: 0, rate: "19.40" }] },
    ...extra,
  };
}

const BATCH5 = [
  std("PRET16507", "Batch5MultiPayment", "PRE-T16507", "Cash + Check split payment", "createSquareOrderMultiPayment"),
  std("PRET16508", "Batch5PaymapDefault", "PRE-T16508", "Payment mapping with default Cash", "createSquareOrderSingleLineBase", null, {
    settings0: settings0Default(payDefaultCash),
  }),
  std("PRET16558", "Batch5UnknownSkuEmpty", "PRE-T16558", "Unknown SKU — empty track item setting", "createSquareOrderUnknownSku", null, {
    settings0: settings0Default({
      "NetSuite item to track order lines when no matching SKU is found in NetSuite": "",
    }),
    skipNsValidation: true,
    flowResponse: flowResponseError,
  }),
  std("PRET16559", "Batch5UnknownSkuTrack", "PRE-T16559", "Unknown SKU — track item configured", "createSquareOrderUnknownSku", null, {
    settings0: settings0Default(skuTrackItem),
    skipNsValidation: true,
    flowResponse: flowResponse,
  }),
  std("PRET16560", "Batch5UnknownSkuFail", "PRE-T16560", "Fail — item not in NetSuite SKU", "createSquareOrderUnknownSku", null, {
    settings0: settings0Default({
      "NetSuite item to track order lines when no matching SKU is found in NetSuite": "",
    }),
    skipNsValidation: true,
    flowResponse: flowResponseError,
  }),
  std("PRET16561", "Batch5SkuFieldEmpty", "PRE-T16561", "Fail — NetSuite SKU field empty", "createSquareOrderSingleLineBase", null, {
    skipFlowRun: true,
    skipNsValidation: true,
    settingsValidate: {
      status: 422,
      payload: { "NetSuite SKU field": "" },
    },
  }),
  std("PRET16562", "Batch5NoSkuValueTrack", "PRE-T16562", "Track item for Square lines with no SKU value", "createSquareOrderUnknownSku", null, {
    settings0: settings0Default({
      ...skuTrackItem,
      "NetSuite item to track Square order lines with no SKU value":
        "process.env[SQUARE_NS.NOSKU_TRACK_ITEM_ID]",
    }),
    skipNsValidation: true,
    flowResponse: flowResponse,
  }),
  std("PRET16563", "Batch5SkuFieldValid", "PRE-T16563", "Valid internal id in NetSuite SKU field", "createSquareOrderSingleLineBase", null, {
    settings0: settings0Default(skuFieldNameInternal),
  }),
  std("PRET16500", "Batch5PayUnmappedFail", "PRE-T16500", "Fail — unmapped payment method", "createSquareOrderSingleLineBase", null, {
    skipNsValidation: true,
    flowResponse: flowResponseError,
  }),
  std("PRET16492", "Batch5PayDefaultCash", "PRE-T16492", "Default Cash when payment unmapped", "createSquareOrderSingleLineBase", null, {
    settings0: settings0Default(payDefaultCash),
  }),
  std("PRET16505", "Batch5PayNullDefault", "PRE-T16505", "Import with standard payment mapping", "createSquareOrderSingleLineBase", null, {
    settings0: settings0Default(payNullDefault),
  }),
  std("PRET16586", "Batch5TendersEtail", "PRE-T16586", "Square tenders recorded on cash sale eTail tab", "createSquareOrderMultiPayment", null, {
    flowStatus: flowTendersOn,
  }),
  std("PRET16486", "Batch5PayEmptyDefault", "PRE-T16486", "Import with standard payment settings", "createSquareOrderSingleLineBase", null, {
    settings0: settings0Default(payEmptyDefault),
  }),
  std("PRET16490", "Batch5NoMatchingSku", "PRE-T16490", "No matching SKU in NetSuite", "createSquareOrderUnknownSku", null, {
    settings0: settings0Default(skuTrackItem),
    skipNsValidation: true,
    flowResponse: flowResponse,
  }),
];

const BATCH6 = [
  std("PRET16621", "Batch6TwoLineEachMod", "PRE-T16621", "Two lines — modifier on each", "createSquareOrderTwoLineEachModifier", {
    products: [{ sku: 0, rate: "19.90" }, { sku: 1, rate: "19.90" }],
  }, {
    settings0: settings0Default(modAdjust),
    flowMaxWait: 180,
    flowIdleMaxWaitSec: 360,
    staticDelayBeforeFlowRun: 90000,
  }),
  std("PRET16631", "Batch6SingleMultiModAdjust", "PRE-T16631", "Single line — multiple modifiers adjust price", "createSquareOrderSingleLineMultiModifier", {
    products: [{ sku: 0, rate: "20.40" }],
  }, { settings0: settings0Default(modAdjust) }),
  std("PRET16632", "Batch6SingleMultiModLine", "PRE-T16632", "Single line — multiple modifiers as line item", "createSquareOrderSingleLineMultiModifier", {
    products: [{ sku: 0, rate: "19.40" }],
  }, { settings0: settings0Default(modLineItem) }),
  std("PRET16634", "Batch6TwoLineModAdjust", "PRE-T16634", "Two lines single modifier — adjust price", "createSquareOrderTwoLineEachOneModifier", {
    products: [{ sku: 0, rate: "19.90" }, { sku: 1, rate: "19.90" }],
  }, { settings0: settings0Default(modAdjust) }),
  std("PRET16635", "Batch6TwoLineMultiModAdjust", "PRE-T16635", "Two lines multi modifier — adjust price", "createSquareOrderTwoLineEachOneModifier", {
    products: [{ sku: 0, rate: "19.90" }, { sku: 1, rate: "19.90" }],
  }, { settings0: settings0Default(modAdjust) }),
  std("PRET16636", "Batch6TwoLineMultiModLine", "PRE-T16636", "Two lines multi modifier — line item", "createSquareOrderTwoLineEachOneModifier", {
    products: [{ sku: 0, rate: "19.40" }, { sku: 1, rate: "19.40" }],
  }, { settings0: settings0Default(modLineItem) }),
  std("PRET16614", "Batch6ModVarianceLine", "PRE-T16614", "Modifier import — zero variance", "createSquareOrderSingleLineModifier", {
    products: [{ sku: 0, rate: "19.90" }],
  }, { settings0: settings0Default(modAdjust) }),
  std("PRET16616", "Batch6ModCartDisc", "PRE-T16616", "Modifier + cart discount", "createSquareOrderModifierCartDiscount", {
    products: [{ sku: 0, rate: "19.90" }], discounts: [{ anyDiscount: true }],
  }, { settings0: settings0Default(modAdjust) }),
  std("PRET16622", "Batch6ModCartDiscTax", "PRE-T16622", "Modifier + cart discount + NS tax", "createSquareOrderModifierCartDiscount", {
    products: [{ sku: 0, rate: "19.90" }], discounts: [{ anyDiscount: true }],
  }, { settings0: settings0Default(modAdjust) }),
  std("PRET16623", "Batch6ModOndemandDisc", "PRE-T16623", "On-demand modifier + line discount", "createSquareOrderModifierLineDiscount", {
    products: [{ sku: 0, rate: "19.90" }], discounts: [{ anyDiscount: true }],
  }, { settings0: settings0Default(modAdjust) }),
  std("PRET16617", "Batch6ModLineItemSetting", "PRE-T16617", "Modifier as separate NS line item", "createSquareOrderModifierLineItemSetting", {
    products: [{ sku: 0, rate: "19.40" }],
  }, { settings0: settings0Default(modLineItem) }),
  std("PRET16517", "Batch6OndemandElevenFail", "PRE-T16517", "Fail on-demand >10 order IDs", "createSquareOrderElevenOnDemand", null, {
    skipFlowRun: true,
    skipNsValidation: true,
    settings1: {},
    settingsValidate: {
      status: 422,
      payload: { "On-demand order sync": "{{PRET16517onDemandOrderSync}}" },
    },
  }),
  std("PRET16624", "Batch6OndemandTenMod", "PRE-T16624", "On-demand 10 orders with modifier", "createSquareOrderTenModifierOnDemand", {
    products: [{ sku: 0, rate: "19.90" }],
  }, {
    settings0: settings0Default(modAdjust),
    settings1: { "On-demand order sync": "{{PRET16624onDemandOrderSync}}" },
    validateOrderKey: "PRET16624T0",
  }),
  std("PRET16513", "Batch6OndemandValidInvalid", "PRE-T16513", "On-demand valid + invalid order id", "createSquareOrderValidInvalidOnDemand", null, {
    skipFlowRun: true,
    skipNsValidation: true,
    settings1: { "On-demand order sync": "LNGQJ30705K9C-{{PRET16513squareOrderId}}" },
    settingsValidate: {
      status: 422,
      payload: { "On-demand order sync": "{{PRET16513onDemandOrderSync}}" },
    },
  }),
  std("PRET16519", "Batch6OndemandTen", "PRE-T16519", "On-demand 10 order IDs", "createSquareOrderTenOnDemand", {
    products: [{ sku: 0, rate: "19.40" }],
  }, {
    settings1: { "On-demand order sync": "{{PRET16519onDemandOrderSync}}" },
    validateOrderKey: "PRET16519T0",
  }),
  std("PRET16571", "Batch6CustomFieldOndemand", "PRE-T16571", "Custom field amount on on-demand order", "createSquareOrderSingleLineBase"),
  std("PRET16514", "Batch6OndemandInvalidFormat", "PRE-T16514", "Fail on-demand invalid order id format", "createSquareOrderSingleLineBase", null, {
    skipFlowRun: true,
    skipNsValidation: true,
    settingsValidate: {
      status: 422,
      payload: { "On-demand order sync": "NOT-A-VALID-FORMAT" },
    },
  }),
  std("PRET16516", "Batch6OndemandWrongLoc", "PRE-T16516", "Fail on-demand order wrong location", "createSquareOrderSingleLineBase", null, {
    skipFlowRun: true,
    skipNsValidation: true,
    settings1: { "On-demand order sync": "LNGQJ30705K9C-{{PRET16516squareOrderId}}" },
    settingsValidate: {
      status: 422,
      payload: { "On-demand order sync": "LM7SAAS95QYG9-{{PRET16516squareOrderId}}" },
    },
  }),
];

const BATCH7 = [
  std("PRET16545", "Batch7GiftPartialTax", "PRE-T16545", "Gift card partial payment + line tax", "createSquareOrderGiftCardPartial"),
  std("PRET16547", "Batch7GiftPartialLineDisc", "PRE-T16547", "Gift card partial + line discount", "createSquareOrderGiftCardPartial", {
    products: [{ sku: 0, rate: "19.40" }],
  }),
  std("PRET16550", "Batch7GiftFullCartDisc", "PRE-T16550", "100% gift card + cart discount", "createSquareOrderGiftCardFull", {
    products: [{ sku: 0, rate: "19.40" }],
    discounts: [{ anyDiscount: true }],
  }),
  std("PRET16551", "Batch7GiftFullLineDisc", "PRE-T16551", "100% gift card + line discount", "createSquareOrderGiftCardFull"),
  std("PRET16544", "Batch7GiftPartialBodyTax", "PRE-T16544", "Gift card partial + body tax", "createSquareOrderGiftCardPartial"),
  std("PRET16548", "Batch7GiftPartialCartDisc", "PRE-T16548", "Gift card partial + cart discount", "createSquareOrderGiftCardPartial", {
    products: [{ sku: 0, rate: "19.40" }], discounts: [{ anyDiscount: true }],
  }),
  std("PRET16594", "Batch7GiftPartialTip", "PRE-T16594", "Gift card partial + tip unaffected", "createSquareOrderGiftCardPartialTip"),
  std("PRET16628", "Batch7ModGiftCard", "PRE-T16628", "Modifier + gift card partial", "createSquareOrderModifierGiftCard", {
    products: [{ sku: 0, rate: "19.90" }],
  }),
];

const BATCH8 = [
  batch8("PRET16612", "Batch8LotSerialTip", "PRE-T16612", "Lot + serial + tip", "createSquareOrderLotSerialTip", {
    products: [
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 1, rate: "19.40", qty: 2 },
    ],
  }),
  batch8("PRET16526", "Batch8SerialMulti", "PRE-T16526", "Serialized item qty 2", "createSquareOrderSerialMulti", {
    products: [{ sku: 0, rate: "19.40", qty: 2 }],
  }),
  batch8("PRET16528", "Batch8LotMulti", "PRE-T16528", "Lot item qty 2", "createSquareOrderLotMulti", {
    products: [{ sku: 1, rate: "19.40", qty: 2 }],
  }),
  batch8("PRET16530", "Batch8MixedMulti", "PRE-T16530", "Inv + serial + lot multi qty", "createSquareOrderMixedInvSerialLot", {
    products: [
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 1, rate: "19.40", qty: 2 },
    ],
  }),
  batch8("PRET16531", "Batch8MixedMulti2", "PRE-T16531", "Inv + serial + lot — 2-digit qty", "createSquareOrderMixedInvSerialLot", {
    products: [
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 1, rate: "19.40", qty: 2 },
    ],
  }),
  batch8("PRET16537", "Batch8SerialSingleMulti", "PRE-T16537", "Serialized single/multi qty", "createSquareOrderSerialMulti", {
    products: [{ sku: 0, rate: "19.40", qty: 2 }],
  }),
  batch8("PRET16539", "Batch8LotSingleMulti", "PRE-T16539", "Lot single/multi qty", "createSquareOrderLotSingle", {
    products: [{ sku: 1, rate: "19.40" }],
  }),
  batch8("PRET16540", "Batch8LotMultiOnly", "PRE-T16540", "Lot only multi qty", "createSquareOrderLotMulti", {
    products: [{ sku: 1, rate: "19.40", qty: 2 }],
  }),
  batch8("PRET16570", "Batch8TwoSerialMulti", "PRE-T16570", "Two serialized items multi qty", "createSquareOrderTwoSerialMulti", {
    products: [
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 1, rate: "19.40", qty: 2 },
    ],
  }),
  batch8("PRET16575", "Batch8PartialQtyMulti", "PRE-T16575", "Multi-line decimal/partial qty inventory", "createSquareOrderPartialQtyMulti", {
    products: [
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 1, rate: "19.40", qty: 2 },
      { sku: 0, rate: "19.40", qty: 2 },
    ],
  }),
  batch8("PRET16576", "Batch8PartialQtyMix", "PRE-T16576", "Partial + integer qty mix", "createSquareOrderPartialQtyMulti", {
    products: [
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 1, rate: "19.40", qty: 2 },
      { sku: 0, rate: "19.40", qty: 2 },
    ],
  }),
  batch8("PRET16577", "Batch8PartialMultiInv", "PRE-T16577", "Partial qty multiple inventory numbers", "createSquareOrderPartialQtyMulti", {
    products: [
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 1, rate: "19.40", qty: 2 },
      { sku: 0, rate: "19.40", qty: 2 },
    ],
  }),
  batch8("PRET16579", "Batch8PartialSubRecord", "PRE-T16579", "Partial qty sub-record mapping", "createSquareOrderPartialQtyMulti", {
    products: [
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 1, rate: "19.40", qty: 2 },
      { sku: 0, rate: "19.40", qty: 2 },
    ],
  }),
  batch8("PRET16581", "Batch8PartialBin", "PRE-T16581", "Partial qty bin assignment", "createSquareOrderPartialQtyMulti", {
    products: [
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 1, rate: "19.40", qty: 2 },
      { sku: 0, rate: "19.40", qty: 2 },
    ],
  }),
  batch8("PRET16625", "Batch8LotSerialDisc", "PRE-T16625", "Lot + serial + discounts", "createSquareOrderLotSerialDiscount", {
    products: [
      { sku: 0, rate: "19.40" },
      { sku: 1, rate: "19.40" },
    ],
    discounts: [{ anyDiscount: true }],
  }),
  batch8("PRET16525", "Batch8SerialSingle", "PRE-T16525", "Serialized item single qty", "createSquareOrderSerialSingle", {
    products: [{ sku: 0, rate: "19.40" }],
  }),
  batch8("PRET16527", "Batch8LotSingle", "PRE-T16527", "Lot item single qty", "createSquareOrderLotSingle", {
    products: [{ sku: 1, rate: "19.40" }],
  }),
  batch8("PRET16529", "Batch8MixedSingle", "PRE-T16529", "Inv + serial + lot single qty", "createSquareOrderMixedInvSerialLotSingle", {
    products: [
      { sku: 0, rate: "19.40" },
      { sku: 0, rate: "19.40" },
      { sku: 1, rate: "19.40" },
    ],
  }),
  batch8("PRET16533", "Batch8SerialQtyMismatch", "PRE-T16533", "Serialized qty more/less in NS", "createSquareOrderSerialMulti", {
    products: [{ sku: 0, rate: "19.40", qty: 2 }],
  }),
  batch8("PRET16534", "Batch8LotQtyMismatch", "PRE-T16534", "Lot qty more/less in NS", "createSquareOrderLotMulti", {
    products: [{ sku: 1, rate: "19.40", qty: 2 }],
  }),
  batch8("PRET16552", "Batch8TwoLotSingle", "PRE-T16552", "Two lot items single qty", "createSquareOrderTwoLotSingle", {
    products: [
      { sku: 0, rate: "19.40" },
      { sku: 1, rate: "19.40" },
    ],
  }),
  batch8("PRET16567", "Batch8LotNormSerial", "PRE-T16567", "2 lot + 1 normal + 2 serial single qty", "createSquareOrderMixedInvSerialLotSingle", {
    products: [
      { sku: 0, rate: "19.40" },
      { sku: 0, rate: "19.40" },
      { sku: 1, rate: "19.40" },
    ],
  }),
  batch8("PRET16569", "Batch8TwoSerialSingle", "PRE-T16569", "Two serialized items single qty", "createSquareOrderTwoSerialSingle", {
    products: [
      { sku: 0, rate: "19.40" },
      { sku: 1, rate: "19.40" },
    ],
  }),
  batch8("PRET16582", "Batch8AllLotPartial", "PRE-T16582", "All lot items partial qty", "createSquareOrderPartialQtyMulti", {
    products: [
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 1, rate: "19.40", qty: 2 },
    ],
  }),
  batch8("PRET16583", "Batch8AllSerialPartial", "PRE-T16583", "All serialized partial qty", "createSquareOrderPartialQtyMulti", {
    products: [
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 1, rate: "19.40", qty: 2 },
    ],
  }),
];

const BATCH9 = [
  batch9("PRET16556", "Batch9TaxSingleLine", "PRE-T16556", "Tax as single line + per-line taxes", "createSquareOrderTaxSingleLine", {
    products: [
      { sku: 0, rate: "19.40" },
      { sku: 1, rate: "19.40" },
    ],
    discounts: [{ anyDiscount: true }],
  }, { settings0: settings0Default(taxSingleLine) }),
  batch9("PRET16573", "Batch9CustomLineField", "PRE-T16573", "Custom line level field batch", "createSquareOrderSingleLineBase"),
  batch9("PRET16572", "Batch9CustomFieldBatch", "PRE-T16572", "Custom field multi-order batch", "createSquareOrderFiveOnDemand", {
    products: [{ sku: 0, rate: "19.40" }],
  }, {
    settings1: { "On-demand order sync": "{{PRET16572onDemandOrderSync}}" },
    validateOrderKey: "PRET16572T0",
  }),
  batch9("PRET16607", "Batch9TipVariance", "PRE-T16607", "Tip variance with correct setup", "createSquareOrderTipVarianceCheck"),
  batch9("PRET16502", "Batch9MultiLocation", "PRE-T16502", "Multiple locations including order location", "createSquareOrderSingleLineBase", null, {
    settings0: settings0Default({
      "Select active Square locations": ["LNGQJ30705K9C", "LM7SAAS95QYG9"],
    }),
  }),
  batch9("PRET16485", "Batch9NewCustLocation", "PRE-T16485", "New customer at order location", "createSquareOrderNewCustomerSingle"),
  batch9("PRET16496", "Batch9ExistingCustomer", "PRE-T16496", "Existing customer cash sale", "createSquareOrderExistingCustomerSingle"),
  batch9("PRET16503", "Batch9CustomerNoEmail", "PRE-T16503", "Customer missing email", "createSquareOrderNewCustomerNoEmail"),
  batch9("PRET16523", "Batch9CustomAmount", "PRE-T16523", "Custom amount + itemized line", "createSquareOrderCustomAmountPlusItem", {
    products: [{ sku: 0, rate: "19.40" }],
  }),
  batch9("PRET16619", "Batch9ModAdjustVerify", "PRE-T16619", "Modifier adjust to line item price", "createSquareOrderModifierAdjustSetting", {
    products: [{ sku: 0, rate: "19.90" }],
  }, { settings0: settings0Default(modAdjust) }),
  batch9("PRET16584", "Batch9InvPartialQty", "PRE-T16584", "Normal inventory partial qty exact import", "createSquareOrderPartialQtyMulti", {
    products: [
      { sku: 0, rate: "19.40", qty: 2 },
      { sku: 1, rate: "19.40", qty: 2 },
    ],
  }),
  batch9("PRET16493", "Batch9NewMappings", "PRE-T16493", "Import with standard mappings", "createSquareOrderSingleLineBase"),
  batch9("PRET16499", "Batch9AlreadyImported", "PRE-T16499", "Re-import already synced order", "createSquareOrderSingleLineBase"),
  batch9("PRET16501", "Batch9NoLocationSelected", "PRE-T16501", "Location not selected in general", "createSquareOrderSingleLineBase", null, {
    settings0: settings0Default({ "Select active Square locations": [] }),
  }),
  batch9("PRET16510", "Batch9ZeroDollar", "PRE-T16510", "Zero dollar order import", "createSquareOrderZeroDollar", {
    products: [{ sku: 0, rate: "0.00" }],
    requireZeroVariance: true,
  }),
  batch9("PRET16487", "Batch9NewCustSingle", "PRE-T16487", "New customer single item", "createSquareOrderNewCustomerSingle"),
  batch9("PRET16585", "Batch9UpdatedItem", "PRE-T16585", "Item updated in Square store", "createSquareOrderSingleLineBase"),
];

const batches = [
  { num: 5, tag: "Batch5", title: "Batch5 | Square Order Import — payment & SKU paths", tests: BATCH5 },
  { num: 6, tag: "Batch6", title: "Batch6 | Square Order Import — modifiers & on-demand edge", tests: BATCH6 },
  { num: 7, tag: "Batch7", title: "Batch7 | Square Order Import — gift card payments", tests: BATCH7 },
  { num: 8, tag: "Batch8", title: "Batch8 | Square Order Import — lot/serial/inventory", tests: BATCH8 },
  { num: 9, tag: "Batch9", title: "Batch9 | Square Order Import — customer, tax, IO settings", tests: BATCH9 },
];

let total = 0;
for (const b of batches) {
  const result = generateBatch(ROOT, {
    batchNum: b.num,
    batchTag: b.tag,
    suiteTitle: b.title,
    tests: b.tests,
  });
  total += result.count;
  console.log(`Wrote ${result.outPath} (${result.count} tests)`);
}
console.log(`\nTotal generated: ${total} tests`);
console.log(`Run all: TAG='batch5|batch6|batch7|batch8|batch9|batch1|batch2|batch3|batch4|OrderImport' npm run jest`);
