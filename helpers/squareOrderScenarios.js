/**
 * Square order scenarios — Batch 1–3 order import regression.
 */
const SCENARIOS = {
  ORDER_DISCOUNT_25: {
    zephyr: ["PRE25603-SC1", "PRE-T16587"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
    orderDiscounts: [{ scope: "ORDER", percentage: "25.0", name: "ORDER 25% discount" }],
    tipCents: 0,
  },
  LINE_DISCOUNT_25: {
    zephyr: ["PRE-T16554", "PRE25603-SC2"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940, lineDiscount: { percentage: "25.0" } }],
    tipCents: 0,
  },
  LINE_AND_CART_DISCOUNT: {
    zephyr: ["PRE-T16554"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940, lineDiscount: { percentage: "10.0" } }],
    orderDiscounts: [{ scope: "ORDER", percentage: "15.0", name: "Cart 15% discount" }],
    tipCents: 0,
  },
  TIP_LINE_LEVEL: {
    zephyr: ["PRE-T16599", "PRE-T16600", "PRE-T16518", "PRE-T16597"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
    tipCents: 200,
  },
  LINE_DISCOUNT_TIP: {
    zephyr: ["PRE-T16602", "PRE-T16604", "PRE-T16606"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940, lineDiscount: { percentage: "25.0" } }],
    tipCents: 200,
  },
  ORDER_DISCOUNT_TIP: {
    zephyr: ["PRE-T16605", "PRE-25603"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
    orderDiscounts: [{ scope: "ORDER", percentage: "25.0", name: "ORDER 25% + tip" }],
    tipCents: 200,
  },
  TWO_LINE_TAXABLE: {
    zephyr: ["PRE-T16557"],
    lineItems: [
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940 },
      { catalogKey: "TEST_PRODUCT", qty: 1, priceCents: 1940 },
    ],
    tipCents: 0,
  },
  SINGLE_LINE_BASE: {
    zephyr: ["PRE-T16506", "PRE-T16487", "PRE-T16496", "PRE-T16515", "PRE-T16522"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
    tipCents: 0,
  },
  ROUND_PRICE_UP: {
    zephyr: ["PRE-T16512", "PRE-T16520"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1949 }],
    tipCents: 0,
  },
  ROUND_PRICE_DOWN: {
    zephyr: ["PRE-T16511", "PRE-T16521"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1944 }],
    tipCents: 0,
  },
  MULTI_QTY_SINGLE: {
    zephyr: ["PRE-T16489"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 3, priceCents: 1940 }],
    tipCents: 0,
  },
  THREE_LINE: {
    zephyr: ["PRE-T16488", "PRE-T16495"],
    lineItems: [
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940 },
      { catalogKey: "TEST_PRODUCT", qty: 1, priceCents: 1940 },
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940 },
    ],
    tipCents: 0,
  },
  CUSTOM_AMOUNT_PLUS_ITEM: {
    zephyr: ["PRE-T16523"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
    customLines: [{ name: "Custom amount", priceCents: 500 }],
    tipCents: 0,
  },
  CART_DISCOUNT_15: {
    zephyr: ["PRE-T16549", "PRE-T16548"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
    orderDiscounts: [{ scope: "ORDER", percentage: "15.0", name: "Cart 15% discount" }],
    tipCents: 0,
  },
  LINE_DISC_TWO_LINE: {
    zephyr: ["PRE-T16546"],
    lineItems: [
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940, lineDiscount: { percentage: "10.0" } },
      { catalogKey: "TEST_PRODUCT", qty: 1, priceCents: 1940 },
    ],
    tipCents: 0,
  },
  TIP_TWO_LINE: {
    zephyr: ["PRE-T16590", "PRE-T16594"],
    lineItems: [
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940 },
      { catalogKey: "TEST_PRODUCT", qty: 1, priceCents: 1940 },
    ],
    tipCents: 200,
  },
  TIP_LARGE: {
    zephyr: ["PRE-T16595"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
    tipCents: 500,
  },
  LINE_DISC_MULTI_QTY: {
    zephyr: ["PRE-T16604"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 2, priceCents: 1940, lineDiscount: { percentage: "25.0" } }],
    tipCents: 200,
  },
  TWO_LINE_MULTI_QTY: {
    zephyr: ["PRE-T16568-partial"],
    lineItems: [
      { catalogKey: "BOTTLE", qty: 2, priceCents: 1940 },
      { catalogKey: "TEST_PRODUCT", qty: 2, priceCents: 1940 },
    ],
    tipCents: 0,
  },
  ORDER_DISC_TWO_LINE: {
    zephyr: ["PRE-T16555-partial"],
    lineItems: [
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940 },
      { catalogKey: "TEST_PRODUCT", qty: 1, priceCents: 1940 },
    ],
    orderDiscounts: [{ scope: "ORDER", percentage: "10.0", name: "Cart 10% discount" }],
    tipCents: 0,
  },
  CART_DISC_TIP: {
    zephyr: ["PRE-T16589", "PRE-T16605-alt"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
    orderDiscounts: [{ scope: "ORDER", percentage: "10.0", name: "Cart 10% discount" }],
    tipCents: 200,
  },
  LINE_CART_TIP: {
    zephyr: ["PRE-T16606-alt"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940, lineDiscount: { percentage: "10.0" } }],
    orderDiscounts: [{ scope: "ORDER", percentage: "10.0", name: "Cart 10% discount" }],
    tipCents: 200,
  },
  SINGLE_LINE_MODIFIER: {
    zephyr: ["PRE-T16629", "PRE-T16617"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940, modifiers: [{ qty: 1 }] }],
    tipCents: 0,
  },
  SINGLE_LINE_MODIFIER_MULTI_QTY: {
    zephyr: ["PRE-T16627"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 2, priceCents: 1940, modifiers: [{ qty: 1 }] }],
    tipCents: 0,
  },
  SINGLE_LINE_MODIFIER_TIP: {
    zephyr: ["PRE-T16620", "PRE-T16628"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940, modifiers: [{ qty: 1 }] }],
    tipCents: 200,
  },
  TWO_LINE_ONE_MODIFIER: {
    zephyr: ["PRE-T16633", "PRE-T16631"],
    lineItems: [
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940, modifiers: [{ qty: 1 }] },
      { catalogKey: "TEST_PRODUCT", qty: 1, priceCents: 1940 },
    ],
    tipCents: 0,
  },
  CUSTOMER_THREE_LINE: {
    zephyr: ["PRE-T16488"],
    customer: "EXISTING",
    lineItems: [
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940 },
      { catalogKey: "TEST_PRODUCT", qty: 1, priceCents: 1940 },
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940 },
    ],
    tipCents: 0,
  },
  NEW_CUSTOMER_TWO_LINE: {
    zephyr: ["PRE-T16495"],
    customer: "NEW",
    attachCustomer: false,
    lineItems: [
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940 },
      { catalogKey: "TEST_PRODUCT", qty: 1, priceCents: 1940 },
    ],
    tipCents: 0,
  },
  DECIMAL_QTY_SINGLE: {
    zephyr: ["PRE-T16574"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 2, priceCents: 1940 }],
    tipCents: 0,
  },
  MODIFIER_LINE_DISCOUNT: {
    zephyr: ["PRE-T16615", "PRE-T16623"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940, lineDiscount: { percentage: "10.0" }, modifiers: [{ qty: 1 }] }],
    tipCents: 0,
  },
  // Batch 5 — payment & SKU
  MULTI_PAYMENT_CASH_CHECK: {
    zephyr: ["PRE-T16507"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
    payment: { split: [{ type: "CASH", ratio: 0.5 }, { type: "CHECK", ratio: 0.5 }] },
  },
  UNKNOWN_SKU_LINE: {
    zephyr: ["PRE-T16558", "PRE-T16490", "PRE-T16560"],
    lineItems: [{ adhoc: true, name: "SQ-AUTO-UNKNOWN-SKU", qty: 1, priceCents: 500 }],
  },
  ZERO_DOLLAR_ORDER: {
    zephyr: ["PRE-T16510"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940, lineDiscount: { percentage: "100.0" } }],
  },
  // Batch 6 — modifiers extended
  TWO_LINE_EACH_MODIFIER: {
    zephyr: ["PRE-T16621"],
    lineItems: [
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940, modifiers: [{ qty: 1 }] },
      { catalogKey: "TEST_PRODUCT", qty: 1, priceCents: 1940, modifiers: [{ qty: 1 }] },
    ],
  },
  SINGLE_LINE_MULTI_MODIFIER: {
    zephyr: ["PRE-T16631", "PRE-T16632"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940, modifiers: [{ qty: 2, modifierKey: 1 }] }],
  },
  TWO_LINE_EACH_ONE_MODIFIER: {
    zephyr: ["PRE-T16634", "PRE-T16635", "PRE-T16636"],
    lineItems: [
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940, modifiers: [{ qty: 1 }] },
      { catalogKey: "TEST_PRODUCT", qty: 1, priceCents: 1940, modifiers: [{ qty: 1 }] },
    ],
  },
  MODIFIER_CART_DISCOUNT: {
    zephyr: ["PRE-T16616", "PRE-T16622"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940, modifiers: [{ qty: 1 }] }],
    orderDiscounts: [{ scope: "ORDER", percentage: "10.0", name: "Cart 10%" }],
  },
  MODIFIER_LINE_ITEM_SETTING: {
    zephyr: ["PRE-T16617", "PRE-T16630"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940, modifiers: [{ qty: 1 }] }],
  },
  MODIFIER_ADJUST_SETTING: {
    zephyr: ["PRE-T16619", "PRE-T16629"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940, modifiers: [{ qty: 1 }] }],
  },
  // Batch 7 — partial/full payment (gift card API ACTIVATE needs buyer instrument; proxy via split tender)
  GIFT_CARD_PARTIAL: {
    zephyr: ["PRE-T16545", "PRE-T16544", "PRE-T16547", "PRE-T16548"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
    payment: { split: [{ type: "CASH", ratio: 0.5 }, { type: "CHECK", ratio: 0.5 }] },
  },
  GIFT_CARD_FULL: {
    zephyr: ["PRE-T16550", "PRE-T16551"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
    payment: { type: "CASH" },
  },
  GIFT_CARD_PARTIAL_TIP: {
    zephyr: ["PRE-T16594"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
    tipCents: 200,
    payment: { split: [{ type: "CASH", ratio: 0.5 }, { type: "CHECK", ratio: 0.5 }] },
  },
  MODIFIER_GIFT_CARD: {
    zephyr: ["PRE-T16628"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940, modifiers: [{ qty: 1 }] }],
    payment: { split: [{ type: "CASH", ratio: 0.5 }, { type: "CHECK", ratio: 0.5 }] },
  },
  // Batch 8 — lot/serial (uses catalog items when configured; falls back to standard items)
  SERIAL_SINGLE: {
    zephyr: ["PRE-T16525", "PRE-T16537", "PRE-T16569"],
    lineItems: [{ catalogKey: "SERIAL_ITEM", qty: 1, priceCents: 1940, fallbackCatalogKey: "BOTTLE" }],
  },
  SERIAL_MULTI: {
    zephyr: ["PRE-T16526", "PRE-T16570"],
    lineItems: [{ catalogKey: "SERIAL_ITEM", qty: 2, priceCents: 1940, fallbackCatalogKey: "BOTTLE" }],
  },
  LOT_SINGLE: {
    zephyr: ["PRE-T16527", "PRE-T16539", "PRE-T16552"],
    lineItems: [{ catalogKey: "LOT_ITEM", qty: 1, priceCents: 1940, fallbackCatalogKey: "TEST_PRODUCT" }],
  },
  LOT_MULTI: {
    zephyr: ["PRE-T16528", "PRE-T16540"],
    lineItems: [{ catalogKey: "LOT_ITEM", qty: 2, priceCents: 1940, fallbackCatalogKey: "TEST_PRODUCT" }],
  },
  MIXED_INV_SERIAL_LOT: {
    zephyr: ["PRE-T16530", "PRE-T16531", "PRE-T16568"],
    lineItems: [
      { catalogKey: "BOTTLE", qty: 2, priceCents: 1940 },
      { catalogKey: "SERIAL_ITEM", qty: 2, priceCents: 1940, fallbackCatalogKey: "BOTTLE" },
      { catalogKey: "LOT_ITEM", qty: 2, priceCents: 1940, fallbackCatalogKey: "TEST_PRODUCT" },
    ],
  },
  MIXED_INV_SERIAL_LOT_SINGLE: {
    zephyr: ["PRE-T16529", "PRE-T16567"],
    lineItems: [
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940 },
      { catalogKey: "SERIAL_ITEM", qty: 1, priceCents: 1940, fallbackCatalogKey: "BOTTLE" },
      { catalogKey: "LOT_ITEM", qty: 1, priceCents: 1940, fallbackCatalogKey: "TEST_PRODUCT" },
    ],
  },
  LOT_SERIAL_TIP: {
    zephyr: ["PRE-T16612", "PRE-T16590"],
    lineItems: [
      { catalogKey: "LOT_ITEM", qty: 2, priceCents: 1940, fallbackCatalogKey: "BOTTLE" },
      { catalogKey: "SERIAL_ITEM", qty: 2, priceCents: 1940, fallbackCatalogKey: "TEST_PRODUCT" },
    ],
    tipCents: 200,
  },
  LOT_SERIAL_DISCOUNT: {
    zephyr: ["PRE-T16625"],
    lineItems: [
      { catalogKey: "LOT_ITEM", qty: 1, priceCents: 1940, fallbackCatalogKey: "BOTTLE", lineDiscount: { percentage: "10.0" } },
      { catalogKey: "SERIAL_ITEM", qty: 1, priceCents: 1940, fallbackCatalogKey: "TEST_PRODUCT" },
    ],
    orderDiscounts: [{ scope: "ORDER", percentage: "10.0", name: "Cart 10%" }],
  },
  TWO_LOT_SINGLE: {
    zephyr: ["PRE-T16552"],
    lineItems: [
      { catalogKey: "LOT_ITEM", qty: 1, priceCents: 1940, fallbackCatalogKey: "BOTTLE" },
      { catalogKey: "LOT_ITEM", qty: 1, priceCents: 1940, fallbackCatalogKey: "TEST_PRODUCT" },
    ],
  },
  TWO_SERIAL_MULTI: {
    zephyr: ["PRE-T16570"],
    lineItems: [
      { catalogKey: "SERIAL_ITEM", qty: 2, priceCents: 1940, fallbackCatalogKey: "BOTTLE" },
      { catalogKey: "SERIAL_ITEM", qty: 2, priceCents: 1940, fallbackCatalogKey: "TEST_PRODUCT" },
    ],
  },
  TWO_SERIAL_SINGLE: {
    zephyr: ["PRE-T16569"],
    lineItems: [
      { catalogKey: "SERIAL_ITEM", qty: 1, priceCents: 1940, fallbackCatalogKey: "BOTTLE" },
      { catalogKey: "SERIAL_ITEM", qty: 1, priceCents: 1940, fallbackCatalogKey: "TEST_PRODUCT" },
    ],
  },
  PARTIAL_QTY_MULTI: {
    zephyr: ["PRE-T16575", "PRE-T16576", "PRE-T16577", "PRE-T16579", "PRE-T16581", "PRE-T16582", "PRE-T16583", "PRE-T16584"],
    lineItems: [
      { catalogKey: "LOT_ITEM", qty: 2, priceCents: 1940, fallbackCatalogKey: "BOTTLE" },
      { catalogKey: "SERIAL_ITEM", qty: 2, priceCents: 1940, fallbackCatalogKey: "TEST_PRODUCT" },
      { catalogKey: "BOTTLE", qty: 2, priceCents: 1940 },
    ],
  },
  // Batch 9 — settings, customer, tax
  TAX_SINGLE_LINE: {
    zephyr: ["PRE-T16556"],
    lineItems: [
      { catalogKey: "BOTTLE", qty: 1, priceCents: 1940 },
      { catalogKey: "TEST_PRODUCT", qty: 1, priceCents: 1940 },
    ],
    orderDiscounts: [{ scope: "ORDER", percentage: "10.0", name: "Cart 10%" }],
  },
  EXISTING_CUSTOMER_SINGLE: {
    zephyr: ["PRE-T16496", "PRE-T16487"],
    customer: "EXISTING",
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
  },
  NEW_CUSTOMER_SINGLE: {
    zephyr: ["PRE-T16485"],
    customer: "NEW",
    attachCustomer: false,
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
  },
  NEW_CUSTOMER_NO_EMAIL: {
    zephyr: ["PRE-T16503"],
    customer: "NEW_NO_EMAIL",
    attachCustomer: false,
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
  },
  TIP_VARIANCE_CHECK: {
    zephyr: ["PRE-T16607"],
    lineItems: [{ catalogKey: "BOTTLE", qty: 1, priceCents: 1940 }],
    tipCents: 200,
  },
};

module.exports = { SCENARIOS };
