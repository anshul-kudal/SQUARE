#!/usr/bin/env node
/**
 * Batch R3 — Line + cart/order discount permutations on refunds (20 TCs).
 *
 * Theme: every discount flavour (line, cart, order, line+cart) crossed with the
 * documented refund kinds (FULL, HALF_AMOUNT, PARTIAL_PCT, FIXED_CENTS), plus the
 * discount + tip pairings. Reuses ONLY existing RETURN_* shapes — no new scenarios.
 *
 * Fixture rules applied (validated live on R0–R2):
 *  - Product base rate "19.40". LINE discount nets INTO the rate (25%→14.55, 10%→17.46).
 *  - CART/ORDER discount keeps the line rate and adds a separate DIS00000 line.
 *  - FULL refund totalAmount = net charged (after discounts), negative; tip excluded
 *    from the NS transaction total and recorded as a separate refundAdjustment.
 *
 * Run: node scripts/generateSquareReturnBatch3.js
 */
const path = require("path");
const { generateReturnBatch } = require("../helpers/squareReturnBatchGenerator");
const { netRate, compoundNetRate } = require("../helpers/squareBatchGenerator");
const { REFUND_KINDS } = require("../helpers/squareReturnScenarios");

const ROOT = path.join(__dirname, "..");
const SKU0 = { sku: 0 };
const SKU1 = { sku: 1 };
const RATE = "19.40";

// Discount-adjusted line rates / nets.
const LINE_25 = netRate(RATE, 0.25); // 14.55 — line 25% nets into the rate
const LINE_10 = netRate(RATE, 0.1); // 17.46 — line 10% nets into the rate
const LINE_CART = compoundNetRate(RATE, 0.1, 0.15); // 14.84 — line 10% then cart 15%
const CART_15 = netRate(RATE, 0.15); // 16.49 — cart 15% net charged
const ORDER_25_NET = netRate(RATE, 0.25); // 14.55 — order 25% net charged
const CART_10 = netRate(RATE, 0.1); // 17.46 — cart/order 10% per-line net (two-line)

// Separate DIS00000 line amounts (gross rate minus net).
const DISC_485 = "-4.85"; // order/line 25% off 19.40
const DISC_291 = "-2.91"; // cart 15% off 19.40
const DISC_262 = "-2.62"; // line 10% + cart 15% residual cart portion
const TIP_200 = "-2.00"; // 200c tip, recorded as adjustment (not in NS total)

/** @param {string} amount */
function refundLine(amount, qty = "-1") {
  return { ...SKU0, amount, qty };
}

function rl(sku, amount, qty = "-1") {
  return { sku, amount, qty: String(qty) };
}

const BATCH = [
  // ---- RETURN_LINE_DISC_25 : line 25% (rate 14.55, net 14.55) ----
  {
    keyPrefix: "PRET16747",
    test: "BatchR3LineDisc25Full",
    zephyr: "PRE-T16747",
    title: "Full refund — line 25% discount (net 14.55)",
    orderScenario: "RETURN_LINE_DISC_25",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: LINE_25, qty: 1 }] },
    expectedRefund: { totalAmount: `-${LINE_25}`, refundLines: [refundLine(`-${LINE_25}`)] },
  },
  {
    keyPrefix: "PRET16748",
    test: "BatchR3LineDisc25Half",
    zephyr: "PRE-T16748",
    title: "Half refund — line 25% discount order",
    orderScenario: "RETURN_LINE_DISC_25",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // Mirrors R1 PRET16713 (same shape+kind): NS renders 7.28 for half of 14.55.
    expectedOrder: { products: [{ ...SKU0, rate: LINE_25, qty: 1 }] },
    expectedRefund: { totalAmount: "-7.28", refundLines: [refundLine("-7.28")] },
  },
  {
    keyPrefix: "PRET16749",
    test: "BatchR3LineDisc25Pct25",
    zephyr: "PRE-T16749",
    title: "Partial 25% refund — line 25% discount order",
    orderScenario: "RETURN_LINE_DISC_25",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.25,
    // floor(1455 * 0.25) = 363c.
    expectedOrder: { products: [{ ...SKU0, rate: LINE_25, qty: 1 }] },
    expectedRefund: { totalAmount: "-3.63", refundLines: [refundLine("-3.63")] },
  },
  {
    keyPrefix: "PRET16750",
    test: "BatchR3LineDisc25Fixed5",
    zephyr: "PRE-T16750",
    title: "Fixed $5 refund — line 25% discount order",
    orderScenario: "RETURN_LINE_DISC_25",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    expectedOrder: { products: [{ ...SKU0, rate: LINE_25, qty: 1 }] },
    expectedRefund: { totalAmount: "-5.00", refundLines: [refundLine("-5.00")] },
  },

  // ---- RETURN_LINE_CART_DISC : line 10% + cart 15% (rate 17.46, cart -2.62, net 14.84) ----
  {
    keyPrefix: "PRET16751",
    test: "BatchR3LineCartFull",
    zephyr: "PRE-T16751",
    title: "Full refund — line 10% + cart 15% discount",
    orderScenario: "RETURN_LINE_CART_DISC",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: LINE_10, qty: 1 }], discounts: [{ rate: DISC_262 }] },
    expectedRefund: { totalAmount: `-${LINE_CART}`, refundLines: [refundLine(`-${LINE_CART}`)] },
  },
  {
    keyPrefix: "PRET16752",
    test: "BatchR3LineCartHalf",
    zephyr: "PRE-T16752",
    title: "Half refund — line 10% + cart 15% discount",
    orderScenario: "RETURN_LINE_CART_DISC",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // Mirrors R1 PRET16717 (same shape+kind): floor(1484/2) = 742c.
    expectedOrder: { products: [{ ...SKU0, rate: LINE_10, qty: 1 }], discounts: [{ rate: DISC_262 }] },
    expectedRefund: { totalAmount: "-7.42", refundLines: [refundLine("-7.42")] },
  },
  {
    keyPrefix: "PRET16753",
    test: "BatchR3LineCartPct50",
    zephyr: "PRE-T16753",
    title: "Partial 50% refund — line 10% + cart 15% discount",
    orderScenario: "RETURN_LINE_CART_DISC",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.5,
    // floor(1484 * 0.5) = 742c.
    expectedOrder: { products: [{ ...SKU0, rate: LINE_10, qty: 1 }], discounts: [{ rate: DISC_262 }] },
    expectedRefund: { totalAmount: "-7.42", refundLines: [refundLine("-7.42")] },
  },

  // ---- RETURN_CART_DISC_15 : cart 15% only (rate 19.40, cart -2.91, net 16.49) ----
  {
    keyPrefix: "PRET16754",
    test: "BatchR3Cart15Full",
    zephyr: "PRE-T16754",
    title: "Full refund — cart 15% discount only",
    orderScenario: "RETURN_CART_DISC_15",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }], discounts: [{ rate: DISC_291 }] },
    expectedRefund: { totalAmount: `-${CART_15}`, refundLines: [refundLine(`-${CART_15}`)] },
  },
  {
    keyPrefix: "PRET16755",
    test: "BatchR3Cart15Fixed10",
    zephyr: "PRE-T16755",
    title: "Fixed $10 refund — cart 15% discount only",
    orderScenario: "RETURN_CART_DISC_15",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 1000,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }], discounts: [{ rate: DISC_291 }] },
    expectedRefund: { totalAmount: "-10.00", refundLines: [refundLine("-10.00")] },
  },
  {
    keyPrefix: "PRET16756",
    test: "BatchR3Cart15Pct25",
    zephyr: "PRE-T16756",
    title: "Partial 25% refund — cart 15% discount only",
    orderScenario: "RETURN_CART_DISC_15",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.25,
    // floor(1649 * 0.25) = 412c.
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }], discounts: [{ rate: DISC_291 }] },
    expectedRefund: { totalAmount: "-4.12", refundLines: [refundLine("-4.12")] },
  },

  // ---- RETURN_ORDER_DISC_25 : order 25% (rate 19.40, order -4.85, net 14.55) ----
  {
    keyPrefix: "PRET16757",
    test: "BatchR3OrderDisc25Full",
    zephyr: "PRE-T16757",
    title: "Full refund — order 25% discount",
    orderScenario: "RETURN_ORDER_DISC_25",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }], discounts: [{ rate: DISC_485 }] },
    expectedRefund: {
      totalAmount: `-${ORDER_25_NET}`,
      refundLines: [refundLine(`-${ORDER_25_NET}`), { item: "DIS00000", amount: DISC_485, qty: "-1" }],
    },
  },
  {
    keyPrefix: "PRET16758",
    test: "BatchR3OrderDisc25Fixed5",
    zephyr: "PRE-T16758",
    title: "Fixed $5 refund — order 25% discount",
    orderScenario: "RETURN_ORDER_DISC_25",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    // Mirrors R1 PRET16715: partial refunds on order-disc orders carry no DIS00000 line.
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }], discounts: [{ rate: DISC_485 }] },
    expectedRefund: { totalAmount: "-5.00", refundLines: [refundLine("-5.00")] },
  },
  {
    keyPrefix: "PRET16759",
    test: "BatchR3OrderDisc25Half",
    zephyr: "PRE-T16759",
    title: "Half refund — order 25% discount",
    orderScenario: "RETURN_ORDER_DISC_25",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // Same net total (1455c) as line-25 half → NS renders 7.28; no DIS00000 on partials.
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }], discounts: [{ rate: DISC_485 }] },
    expectedRefund: { totalAmount: "-7.28", refundLines: [refundLine("-7.28")] },
  },

  // ---- RETURN_ORDER_DISC_TWO_LINE : cart 10% on two lines (net 17.46/line, 34.92 total) ----
  {
    keyPrefix: "PRET16760",
    test: "BatchR3OrderDisc2LFull",
    zephyr: "PRE-T16760",
    title: "Full refund — cart 10% on two-line order",
    orderScenario: "RETURN_ORDER_DISC_TWO_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
      discounts: [{ anyDiscount: true }],
    },
    expectedRefund: {
      totalAmount: "-34.92",
      refundLines: [rl(0, `-${CART_10}`), rl(1, `-${CART_10}`)],
    },
  },
  {
    keyPrefix: "PRET16761",
    test: "BatchR3OrderDisc2LHalf",
    zephyr: "PRE-T16761",
    title: "Half refund — cart 10% on two-line order",
    orderScenario: "RETURN_ORDER_DISC_TWO_LINE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(3492/2) = 1746c → maps to the first line's net (17.46).
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
      discounts: [{ anyDiscount: true }],
    },
    expectedRefund: { totalAmount: `-${CART_10}`, refundLines: [rl(0, `-${CART_10}`)] },
  },
  {
    keyPrefix: "PRET16762",
    test: "BatchR3OrderDisc2LPct25",
    zephyr: "PRE-T16762",
    title: "Partial 25% refund — cart 10% on two-line order",
    orderScenario: "RETURN_ORDER_DISC_TWO_LINE",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.25,
    // floor(3492 * 0.25) = 873c, applied against the first line.
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
      discounts: [{ anyDiscount: true }],
    },
    expectedRefund: { totalAmount: "-8.73", refundLines: [rl(0, "-8.73")] },
  },

  // ---- RETURN_LINE_DISC_TWO_LINE : line 10% on line 0 of two (17.46 + 19.40, net 36.86) ----
  {
    keyPrefix: "PRET16763",
    test: "BatchR3LineDisc2LFull",
    zephyr: "PRE-T16763",
    title: "Full refund — line 10% disc on line 1 of two",
    orderScenario: "RETURN_LINE_DISC_TWO_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [
        { ...SKU0, rate: LINE_10, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: {
      totalAmount: "-36.86",
      refundLines: [rl(0, `-${LINE_10}`), rl(1, "-19.40")],
    },
  },
  {
    keyPrefix: "PRET16764",
    test: "BatchR3LineDisc2LFixed15",
    zephyr: "PRE-T16764",
    title: "Fixed $15 refund — line-discounted two-line order",
    orderScenario: "RETURN_LINE_DISC_TWO_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 1500,
    // $15 < line 0 net (17.46) → applied against the first (discounted) line.
    expectedOrder: {
      products: [
        { ...SKU0, rate: LINE_10, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-15.00", refundLines: [rl(0, "-15.00")] },
  },

  // ---- RETURN_LINE_DISC_TIP : line 25% + tip (rate 14.55, net 14.55, tip 2.00) ----
  {
    keyPrefix: "PRET16765",
    test: "BatchR3LineDiscTipFull",
    zephyr: "PRE-T16765",
    title: "Full refund — line 25% discount with tip",
    orderScenario: "RETURN_LINE_DISC_TIP",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: LINE_25, qty: 1 }] },
    expectedRefund: {
      // Tip is a separate adjustment, excluded from the NS transaction total.
      totalAmount: `-${LINE_25}`,
      refundLines: [refundLine(`-${LINE_25}`)],
      refundAdjustments: [{ item: "Tip", amount: TIP_200 }],
    },
  },

  // ---- RETURN_ORDER_DISC_TIP : order 25% + tip (rate 19.40, order -4.85, net 14.55, tip 2.00) ----
  {
    keyPrefix: "PRET16766",
    test: "BatchR3OrderDiscTipFull",
    zephyr: "PRE-T16766",
    title: "Full refund — order 25% discount with tip",
    orderScenario: "RETURN_ORDER_DISC_TIP",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }], discounts: [{ rate: DISC_485 }] },
    expectedRefund: {
      totalAmount: `-${ORDER_25_NET}`,
      refundLines: [refundLine(`-${ORDER_25_NET}`), { item: "DIS00000", amount: DISC_485, qty: "-1" }],
      refundAdjustments: [{ item: "Tip", amount: TIP_200 }],
    },
  },
];

const result = generateReturnBatch(ROOT, {
  batchTag: "BatchR3",
  suiteTitle: "BatchR3 | Square Return/Refund — line & cart/order discount permutations (20 TCs)",
  tests: BATCH,
  outFileName: "BatchR3_DiscountPermutations.json",
});

console.log(
  `Wrote ${result.outPath} (${result.count} TCs, ${result.interactions} interactions)`
);
