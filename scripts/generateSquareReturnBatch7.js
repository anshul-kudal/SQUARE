#!/usr/bin/env node
/**
 * Batch R7 — Multi-quantity / unit-level refund permutations (18 TCs).
 *
 * Theme: the quantity-proration gap not covered by R0–R6. Orders with qty>1 lines,
 * refunded at the unit level (1 unit, N units, whole line, full order), single-line
 * and multi-line, with and without a line discount. Built ONLY from existing RETURN_*
 * shapes (mirrors R3/R6 — no new scenarios):
 *   - RETURN_MULTI_QTY            single line, BOTTLE qty 3 @ 19.40 (line/total 58.20)
 *   - RETURN_LINE_DISC_MULTI_QTY  BOTTLE qty 2 @ 19.40, 25% line disc → rate 14.55
 *                                 (line 29.10) + 200c tip (order total_money 31.10)
 *   - RETURN_TWO_LINE_MULTI_QTY   line0 BOTTLE qty 2 + line1 TEST_PRODUCT qty 2,
 *                                 each @ 19.40 (each line 38.80, total 77.60)
 *
 * Fixture math (validated live on R0–R6 + the rules in the R7 brief):
 *   - Product base rate 19.40. A LINE discount nets INTO the item rate (25% → 14.55);
 *     no separate DIS00000 line for a line discount.
 *   - A qty>1 line's NS amount = rate × qty (19.40 × 3 = 58.20; 14.55 × 2 = 29.10).
 *   - Unit refund math (helpers/squareDataCreation.js createSquareRefund):
 *       ONE_UNIT             = round(line0.total / line0.qty)            → one unit of line 0
 *       PARTIAL_QTY (qty=N)  = round((line.total / line.qty) * min(N,qty)) on lineIndex
 *       PARTIAL_LINE_INDEX   = that line's whole total_money (all its units)
 *       FULL                 = order total_money (all lines, incl. tip)
 *   - Refund NS line Quantity is negative (refund convention; existing fixtures use "-1").
 *     R7 reflects the refunded unit count as a signed magnitude: 1 unit → "-1",
 *     2 units → "-2", 3 units → "-3". (See TODO(qty-sign) — verify in the live run.)
 *   - Tip is excluded from the NS transaction total and recorded as a separate Tip
 *     refundAdjustment, but only when the tip is actually refunded (FULL). Partial/unit
 *     refunds below the tip-inclusive total do not refund the tip → no Tip adjustment.
 *   - eTail Refund Exported ("F"), Payment Method (""), Location come from
 *     buildExpectedCashRefund — reused exactly as R3/R6 do. All variances = 0.
 *
 * Run: node scripts/generateSquareReturnBatch7.js
 */
const path = require("path");
const { generateReturnBatch } = require("../helpers/squareReturnBatchGenerator");
const { netRate } = require("../helpers/squareBatchGenerator");
const { REFUND_KINDS } = require("../helpers/squareReturnScenarios");

const ROOT = path.join(__dirname, "..");
const SKU0 = { sku: 0 };
const SKU1 = { sku: 1 };
const RATE = "19.40";
const LINE_25 = netRate(RATE, 0.25); // "14.55" — line 25% nets into the rate
const TIP_200 = "-2.00"; // RETURN_LINE_DISC_MULTI_QTY carries a 200c tip

/** @param {number} sku @param {string} amount @param {string|number} qty */
function rl(sku, amount, qty = "-1") {
  return { sku, amount, qty: String(qty) };
}

const BATCH = [
  // ---- RETURN_MULTI_QTY: single line, BOTTLE qty 3 @ 19.40 (line/total 58.20) ----
  {
    keyPrefix: "PRET16823",
    test: "BatchR7MultiQty3OneUnit",
    zephyr: "PRE-T16823",
    title: "Unit refund — 1 of 3 units (qty-3 single line)",
    orderScenario: "RETURN_MULTI_QTY",
    refundKind: REFUND_KINDS.ONE_UNIT,
    // round(5820/3) = 1940 → 19.40
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 3 }] },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(0, "-19.40", "-1")] },
  },
  {
    keyPrefix: "PRET16824",
    test: "BatchR7MultiQty3PartialQty1",
    zephyr: "PRE-T16824",
    title: "Partial-qty refund — 1 unit of qty-3 single line",
    orderScenario: "RETURN_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_QTY,
    refundQty: 1,
    // round((5820/3) * 1) = 1940 → 19.40
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 3 }] },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(0, "-19.40", "-1")] },
  },
  {
    keyPrefix: "PRET16825",
    test: "BatchR7MultiQty3PartialQty2",
    zephyr: "PRE-T16825",
    title: "Partial-qty refund — 2 units of qty-3 single line",
    orderScenario: "RETURN_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_QTY,
    refundQty: 2,
    // round((5820/3) * 2) = 3880 → 38.80
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 3 }] },
    expectedRefund: { totalAmount: "-38.80", refundLines: [rl(0, "-38.80", "-2")] },
  },
  {
    keyPrefix: "PRET16826",
    test: "BatchR7MultiQty3LineIndex",
    zephyr: "PRE-T16826",
    title: "Whole-line refund — qty-3 single line (line index 0)",
    orderScenario: "RETURN_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    // whole line 0 total_money = 5820 → 58.20 (all 3 units)
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 3 }] },
    expectedRefund: { totalAmount: "-58.20", refundLines: [rl(0, "-58.20", "-3")] },
  },
  {
    keyPrefix: "PRET16827",
    test: "BatchR7MultiQty3Full",
    zephyr: "PRE-T16827",
    title: "Full refund — qty-3 single line (all units)",
    orderScenario: "RETURN_MULTI_QTY",
    refundKind: REFUND_KINDS.FULL,
    // order total_money = 5820 → 58.20
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 3 }] },
    expectedRefund: { totalAmount: "-58.20", refundLines: [rl(0, "-58.20", "-3")] },
  },

  // ---- RETURN_LINE_DISC_MULTI_QTY: BOTTLE qty 2, 25% line disc (rate 14.55, line 29.10) + 200c tip ----
  {
    keyPrefix: "PRET16828",
    test: "BatchR7LineDiscMq2OneUnit",
    zephyr: "PRE-T16828",
    title: "Unit refund — 1 of 2 units, 25% line-discounted line (rate 14.55)",
    orderScenario: "RETURN_LINE_DISC_MULTI_QTY",
    refundKind: REFUND_KINDS.ONE_UNIT,
    // line0 total 2910, qty 2 → round(2910/2) = 1455 → 14.55 (tip not refunded)
    expectedOrder: { products: [{ ...SKU0, rate: LINE_25, qty: 2 }] },
    expectedRefund: { totalAmount: "-14.55", refundLines: [rl(0, "-14.55", "-1")] },
  },
  {
    keyPrefix: "PRET16829",
    test: "BatchR7LineDiscMq2PartialQty1",
    zephyr: "PRE-T16829",
    title: "Partial-qty refund — 1 unit of 25% line-discounted qty-2 line",
    orderScenario: "RETURN_LINE_DISC_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_QTY,
    refundQty: 1,
    // round((2910/2) * 1) = 1455 → 14.55
    expectedOrder: { products: [{ ...SKU0, rate: LINE_25, qty: 2 }] },
    expectedRefund: { totalAmount: "-14.55", refundLines: [rl(0, "-14.55", "-1")] },
  },
  {
    keyPrefix: "PRET16830",
    test: "BatchR7LineDiscMq2PartialQty2",
    zephyr: "PRE-T16830",
    title: "Partial-qty refund — both units of 25% line-discounted qty-2 line",
    orderScenario: "RETURN_LINE_DISC_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_QTY,
    refundQty: 2,
    // round((2910/2) * 2) = 2910 → 29.10 (line only, tip not refunded)
    expectedOrder: { products: [{ ...SKU0, rate: LINE_25, qty: 2 }] },
    expectedRefund: { totalAmount: "-29.10", refundLines: [rl(0, "-29.10", "-2")] },
  },
  {
    keyPrefix: "PRET16831",
    test: "BatchR7LineDiscMq2LineIndex",
    zephyr: "PRE-T16831",
    title: "Whole-line refund — 25% line-discounted qty-2 line (line index 0)",
    orderScenario: "RETURN_LINE_DISC_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    // whole line 0 total_money = 2910 → 29.10 (tip not refunded on a line-scoped refund)
    expectedOrder: { products: [{ ...SKU0, rate: LINE_25, qty: 2 }] },
    expectedRefund: { totalAmount: "-29.10", refundLines: [rl(0, "-29.10", "-2")] },
  },
  {
    keyPrefix: "PRET16832",
    test: "BatchR7LineDiscMq2Full",
    zephyr: "PRE-T16832",
    title: "Full refund — 25% line-discounted qty-2 line with tip",
    orderScenario: "RETURN_LINE_DISC_MULTI_QTY",
    refundKind: REFUND_KINDS.FULL,
    // order total_money = 2910 + 200 tip = 3110; NS total excludes tip (-29.10), Tip adj -2.00
    expectedOrder: { products: [{ ...SKU0, rate: LINE_25, qty: 2 }] },
    expectedRefund: {
      totalAmount: "-29.10",
      refundLines: [rl(0, "-29.10", "-2")],
      refundAdjustments: [{ item: "Tip", amount: TIP_200 }],
    },
  },

  // ---- RETURN_TWO_LINE_MULTI_QTY: line0 qty 2 + line1 qty 2 @ 19.40 (each 38.80, total 77.60) ----
  {
    keyPrefix: "PRET16833",
    test: "BatchR7TwoLineMqOneUnit",
    zephyr: "PRE-T16833",
    title: "Unit refund — 1 unit of line 0 (two-line qty-2 each)",
    orderScenario: "RETURN_TWO_LINE_MULTI_QTY",
    refundKind: REFUND_KINDS.ONE_UNIT,
    // ONE_UNIT always targets line 0: round(3880/2) = 1940 → 19.40
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 2 },
        { ...SKU1, rate: RATE, qty: 2 },
      ],
    },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(0, "-19.40", "-1")] },
  },
  {
    keyPrefix: "PRET16834",
    test: "BatchR7TwoLineMqPartialL0One",
    zephyr: "PRE-T16834",
    title: "Partial-qty refund — 1 unit of line 0 (two-line qty-2 each)",
    orderScenario: "RETURN_TWO_LINE_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_QTY,
    refundQty: 1,
    lineIndex: 0,
    // round((3880/2) * 1) = 1940 → 19.40
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 2 },
        { ...SKU1, rate: RATE, qty: 2 },
      ],
    },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(0, "-19.40", "-1")] },
  },
  {
    keyPrefix: "PRET16835",
    test: "BatchR7TwoLineMqPartialL0Two",
    zephyr: "PRE-T16835",
    title: "Partial-qty refund — both units of line 0 (two-line qty-2 each)",
    orderScenario: "RETURN_TWO_LINE_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_QTY,
    refundQty: 2,
    lineIndex: 0,
    // round((3880/2) * 2) = 3880 → 38.80
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 2 },
        { ...SKU1, rate: RATE, qty: 2 },
      ],
    },
    expectedRefund: { totalAmount: "-38.80", refundLines: [rl(0, "-38.80", "-2")] },
  },
  {
    keyPrefix: "PRET16836",
    test: "BatchR7TwoLineMqPartialL1One",
    zephyr: "PRE-T16836",
    title: "Partial-qty refund — 1 unit of line 1 (two-line qty-2 each)",
    orderScenario: "RETURN_TWO_LINE_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_QTY,
    refundQty: 1,
    lineIndex: 1,
    // line 1 total 3880, qty 2 → round((3880/2) * 1) = 1940 → 19.40 on SKU1
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 2 },
        { ...SKU1, rate: RATE, qty: 2 },
      ],
    },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(1, "-19.40", "-1")] },
  },
  {
    keyPrefix: "PRET16837",
    test: "BatchR7TwoLineMqPartialL1Two",
    zephyr: "PRE-T16837",
    title: "Partial-qty refund — both units of line 1 (two-line qty-2 each)",
    orderScenario: "RETURN_TWO_LINE_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_QTY,
    refundQty: 2,
    lineIndex: 1,
    // round((3880/2) * 2) = 3880 → 38.80 on SKU1
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 2 },
        { ...SKU1, rate: RATE, qty: 2 },
      ],
    },
    expectedRefund: { totalAmount: "-38.80", refundLines: [rl(1, "-38.80", "-2")] },
  },
  {
    keyPrefix: "PRET16838",
    test: "BatchR7TwoLineMqLineIndex0",
    zephyr: "PRE-T16838",
    title: "Whole-line refund — line 0 (two-line qty-2 each, line index 0)",
    orderScenario: "RETURN_TWO_LINE_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    // whole line 0 total_money = 3880 → 38.80
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 2 },
        { ...SKU1, rate: RATE, qty: 2 },
      ],
    },
    expectedRefund: { totalAmount: "-38.80", refundLines: [rl(0, "-38.80", "-2")] },
  },
  {
    keyPrefix: "PRET16839",
    test: "BatchR7TwoLineMqLineIndex1",
    zephyr: "PRE-T16839",
    title: "Whole-line refund — line 1 (two-line qty-2 each, line index 1)",
    orderScenario: "RETURN_TWO_LINE_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 1,
    // whole line 1 total_money = 3880 → 38.80 on SKU1
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 2 },
        { ...SKU1, rate: RATE, qty: 2 },
      ],
    },
    expectedRefund: { totalAmount: "-38.80", refundLines: [rl(1, "-38.80", "-2")] },
  },
  {
    keyPrefix: "PRET16840",
    test: "BatchR7TwoLineMqFull",
    zephyr: "PRE-T16840",
    title: "Full refund — two-line qty-2 each (all units, both lines)",
    orderScenario: "RETURN_TWO_LINE_MULTI_QTY",
    refundKind: REFUND_KINDS.FULL,
    // order total_money = 7760 → 77.60 (line0 -38.80 qty-2 + line1 -38.80 qty-2)
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 2 },
        { ...SKU1, rate: RATE, qty: 2 },
      ],
    },
    expectedRefund: {
      totalAmount: "-77.60",
      refundLines: [rl(0, "-38.80", "-2"), rl(1, "-38.80", "-2")],
    },
  },
];

const result = generateReturnBatch(ROOT, {
  batchTag: "BatchR7",
  suiteTitle:
    "BatchR7 | Square Return/Refund — multi-quantity / unit-level refund permutations (18 TCs)",
  tests: BATCH,
  outFileName: "BatchR7_MultiQuantity.json",
});

console.log(
  `Wrote ${result.outPath} (${result.count} TCs, ${result.interactions} interactions)`
);
