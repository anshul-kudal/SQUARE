#!/usr/bin/env node
/**
 * Batch R4 — Tip & tip+discount refund permutations (18 TCs).
 *
 * THEME: tips and tip+discount refund permutations. Square has no dedicated
 * "service charge" RETURN_* shape, so tip shapes (RETURN_TIP_LINE,
 * RETURN_TIP_TWO_LINE, RETURN_LINE_DISC_TIP, RETURN_ORDER_DISC_TIP) stand in
 * for service-charge / adjustment coverage. See // TODO markers below where a
 * true service-charge shape would be required.
 *
 * Fixture rules (validated live on R0–R2):
 *  - Product base rate = "19.40".
 *  - LINE discount nets into the line rate (25%→"14.55"); no separate line.
 *  - ORDER/CART discount = separate DIS00000 line; product rate unchanged.
 *  - TIP is a separate refundAdjustments [{ item: "Tip", amount: "-X.XX" }] and
 *    is NOT part of expectedRefund.totalAmount (NS total excludes tip). Only the
 *    FULL refund records the tip adjustment; partial refunds do not.
 *  - PARTIAL_PCT / HALF_AMOUNT / FIXED_CENTS apply to the line net (tip excluded).
 *
 * Run: node scripts/generateSquareReturnBatch4.js
 */
const path = require("path");
const { generateReturnBatch } = require("../helpers/squareReturnBatchGenerator");
const { netRate } = require("../helpers/squareBatchGenerator");
const { REFUND_KINDS } = require("../helpers/squareReturnScenarios");

const ROOT = path.join(__dirname, "..");
const SKU0 = { sku: 0 };
const SKU1 = { sku: 1 };
const RATE = "19.40";
const LINE_DISC_25_NET = netRate(RATE, 0.25); // "14.55"
const ORDER_DISC_485 = "-4.85"; // 25% of 19.40 as separate DIS00000 line
const TIP_ADJ = { item: "Tip", amount: "-2.00" };
const DIS_LINE = { item: "DIS00000", amount: ORDER_DISC_485, qty: "-1" };

/** @param {number} sku @param {string} amount @param {string} [qty] */
function rl(sku, amount, qty = "-1") {
  return { sku, amount, qty: String(qty) };
}

const BATCH = [
  // ---- Shape A: RETURN_TIP_LINE — single line $19.40 + $2.00 tip ----
  {
    keyPrefix: "PRET16767",
    test: "BatchR4TipLineFull",
    zephyr: "PRE-T16767",
    title: "Full refund — single line with tip",
    orderScenario: "RETURN_TIP_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: {
      // Tip excluded from NS total; recorded as a separate adjustment.
      totalAmount: "-19.40",
      refundLines: [rl(0, "-19.40")],
      refundAdjustments: [TIP_ADJ],
    },
  },
  {
    keyPrefix: "PRET16768",
    test: "BatchR4TipLineHalf",
    zephyr: "PRE-T16768",
    title: "Partial refund — 50% on tipped single line",
    orderScenario: "RETURN_TIP_LINE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.70", refundLines: [rl(0, "-9.70")] },
  },
  {
    keyPrefix: "PRET16769",
    test: "BatchR4TipLinePct25",
    zephyr: "PRE-T16769",
    title: "Partial refund — 25% on tipped single line",
    orderScenario: "RETURN_TIP_LINE",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.25,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-4.85", refundLines: [rl(0, "-4.85")] },
  },
  {
    keyPrefix: "PRET16770",
    test: "BatchR4TipLineFixed10",
    zephyr: "PRE-T16770",
    title: "Partial refund — $10 on tipped single line",
    orderScenario: "RETURN_TIP_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 1000,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-10.00", refundLines: [rl(0, "-10.00")] },
  },
  {
    keyPrefix: "PRET16771",
    test: "BatchR4TipLineFixedTipSized",
    zephyr: "PRE-T16771",
    // TODO: with a true service-charge shape this would refund only the service
    // charge line; here a $2.00 fixed refund stands in for that adjustment value.
    title: "Partial refund — $2.00 (tip-sized stand-in for service charge)",
    orderScenario: "RETURN_TIP_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 200,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-2.00", refundLines: [rl(0, "-2.00")] },
  },

  // ---- Shape B: RETURN_TIP_TWO_LINE — two lines $19.40 + $2.00 tip ----
  {
    keyPrefix: "PRET16772",
    test: "BatchR4TipTwoLineFull",
    zephyr: "PRE-T16772",
    title: "Full refund — two lines with tip",
    orderScenario: "RETURN_TIP_TWO_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: {
      totalAmount: "-38.80",
      refundLines: [rl(0, "-19.40"), rl(1, "-19.40")],
      refundAdjustments: [TIP_ADJ],
    },
  },
  {
    keyPrefix: "PRET16773",
    test: "BatchR4TipTwoLineHalf",
    zephyr: "PRE-T16773",
    title: "Partial refund — 50% on tipped two-line order",
    orderScenario: "RETURN_TIP_TWO_LINE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(0, "-19.40")] },
  },
  {
    keyPrefix: "PRET16774",
    test: "BatchR4TipTwoLinePct25",
    zephyr: "PRE-T16774",
    title: "Partial refund — 25% on tipped two-line order",
    orderScenario: "RETURN_TIP_TWO_LINE",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.25,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-9.70", refundLines: [rl(0, "-9.70")] },
  },
  {
    keyPrefix: "PRET16775",
    test: "BatchR4TipTwoLineFixed15",
    zephyr: "PRE-T16775",
    title: "Partial refund — $15 on tipped two-line order",
    orderScenario: "RETURN_TIP_TWO_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 1500,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-15.00", refundLines: [rl(0, "-15.00")] },
  },
  {
    keyPrefix: "PRET16776",
    test: "BatchR4TipTwoLineFixedTipSized",
    zephyr: "PRE-T16776",
    // TODO: a true service-charge shape would refund the charge line on a
    // multi-line order; $2.00 fixed stands in for that adjustment value here.
    title: "Partial refund — $2.00 (tip-sized stand-in for service charge)",
    orderScenario: "RETURN_TIP_TWO_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 200,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-2.00", refundLines: [rl(0, "-2.00")] },
  },

  // ---- Shape C: RETURN_LINE_DISC_TIP — line 25% disc (→14.55) + $2.00 tip ----
  // Line discount nets into the rate; no separate DIS00000 line.
  {
    keyPrefix: "PRET16777",
    test: "BatchR4LineDiscTipFull",
    zephyr: "PRE-T16777",
    title: "Full refund — line 25% disc with tip",
    orderScenario: "RETURN_LINE_DISC_TIP",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: LINE_DISC_25_NET, qty: 1 }] },
    expectedRefund: {
      totalAmount: `-${LINE_DISC_25_NET}`,
      refundLines: [rl(0, `-${LINE_DISC_25_NET}`)],
      refundAdjustments: [TIP_ADJ],
    },
  },
  {
    keyPrefix: "PRET16778",
    test: "BatchR4LineDiscTipHalf",
    zephyr: "PRE-T16778",
    title: "Partial refund — 50% on line-disc tipped order",
    orderScenario: "RETURN_LINE_DISC_TIP",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    expectedOrder: { products: [{ ...SKU0, rate: LINE_DISC_25_NET, qty: 1 }] },
    // 14.55 / 2 = 7.275 → Square rounds half-up to 7.28 (validated in R1).
    expectedRefund: { totalAmount: "-7.28", refundLines: [rl(0, "-7.28")] },
  },
  {
    keyPrefix: "PRET16779",
    test: "BatchR4LineDiscTipPct20",
    zephyr: "PRE-T16779",
    title: "Partial refund — 20% on line-disc tipped order",
    orderScenario: "RETURN_LINE_DISC_TIP",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.2,
    expectedOrder: { products: [{ ...SKU0, rate: LINE_DISC_25_NET, qty: 1 }] },
    // 14.55 * 0.20 = 2.91 (clean cents).
    expectedRefund: { totalAmount: "-2.91", refundLines: [rl(0, "-2.91")] },
  },
  {
    keyPrefix: "PRET16780",
    test: "BatchR4LineDiscTipFixed5",
    zephyr: "PRE-T16780",
    title: "Partial refund — $5 on line-disc tipped order",
    orderScenario: "RETURN_LINE_DISC_TIP",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    expectedOrder: { products: [{ ...SKU0, rate: LINE_DISC_25_NET, qty: 1 }] },
    expectedRefund: { totalAmount: "-5.00", refundLines: [rl(0, "-5.00")] },
  },

  // ---- Shape D: RETURN_ORDER_DISC_TIP — line $19.40 + order 25% disc + $2.00 tip ----
  // Order discount is a separate DIS00000 line; product rate unchanged at 19.40.
  {
    keyPrefix: "PRET16781",
    test: "BatchR4OrderDiscTipFull",
    zephyr: "PRE-T16781",
    title: "Full refund — order 25% disc with tip",
    orderScenario: "RETURN_ORDER_DISC_TIP",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [{ ...SKU0, rate: RATE, qty: 1 }],
      discounts: [{ rate: ORDER_DISC_485 }],
    },
    expectedRefund: {
      totalAmount: "-14.55",
      refundLines: [rl(0, "-14.55"), DIS_LINE],
      refundAdjustments: [TIP_ADJ],
    },
  },
  {
    keyPrefix: "PRET16782",
    test: "BatchR4OrderDiscTipHalf",
    zephyr: "PRE-T16782",
    title: "Partial refund — 50% on order-disc tipped order",
    orderScenario: "RETURN_ORDER_DISC_TIP",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    expectedOrder: {
      products: [{ ...SKU0, rate: RATE, qty: 1 }],
      discounts: [{ rate: ORDER_DISC_485 }],
    },
    // 14.55 net / 2 = 7.275 → 7.28; partial refund omits the DIS00000 line.
    expectedRefund: { totalAmount: "-7.28", refundLines: [rl(0, "-7.28")] },
  },
  {
    keyPrefix: "PRET16783",
    test: "BatchR4OrderDiscTipPct40",
    zephyr: "PRE-T16783",
    title: "Partial refund — 40% on order-disc tipped order",
    orderScenario: "RETURN_ORDER_DISC_TIP",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.4,
    expectedOrder: {
      products: [{ ...SKU0, rate: RATE, qty: 1 }],
      discounts: [{ rate: ORDER_DISC_485 }],
    },
    // 14.55 * 0.40 = 5.82 (clean cents).
    expectedRefund: { totalAmount: "-5.82", refundLines: [rl(0, "-5.82")] },
  },
  {
    keyPrefix: "PRET16784",
    test: "BatchR4OrderDiscTipFixed10",
    zephyr: "PRE-T16784",
    title: "Partial refund — $10 on order-disc tipped order",
    orderScenario: "RETURN_ORDER_DISC_TIP",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 1000,
    expectedOrder: {
      products: [{ ...SKU0, rate: RATE, qty: 1 }],
      discounts: [{ rate: ORDER_DISC_485 }],
    },
    expectedRefund: { totalAmount: "-10.00", refundLines: [rl(0, "-10.00")] },
  },
];

// TODO(service-charge): Square exposes no "service charge" RETURN_* shape today.
// Batch R4 substitutes tip shapes (RETURN_TIP_LINE / RETURN_TIP_TWO_LINE /
// RETURN_LINE_DISC_TIP / RETURN_ORDER_DISC_TIP) as adjustment-level coverage.
// When a true service-charge shape (e.g. RETURN_SERVICE_CHARGE_LINE) lands in
// helpers/squareReturnScenarios.js, replace the tip shapes above and assert the
// service charge as its own refundAdjustments entry instead of { item: "Tip" }.
const result = generateReturnBatch(ROOT, {
  batchTag: "BatchR4",
  suiteTitle:
    "BatchR4 | Square Return/Refund — tip & tip+discount permutations (18 TCs)",
  tests: BATCH,
  outFileName: "BatchR4_TipAndAdjustment.json",
});

console.log(
  `Wrote ${result.outPath} (${result.count} TCs, ${result.interactions} interactions)`
);
