#!/usr/bin/env node
/**
 * Batch R9 — Lot / Serial / inventory-detail refund permutations (16 TCs).
 *
 * Theme: refunds of inventory-detail items (lot- and serial-tracked) — the gap
 * not covered by R0–R8. Built ONLY from existing RETURN_* shapes that wrap the
 * Batch 8 lot/serial order scenarios (mirrors R6/R7 — no new order scenarios):
 *   - RETURN_SERIAL_SINGLE                serial item, qty 1 @ 19.40 (SKU0)
 *   - RETURN_SERIAL_MULTI                 serial item, qty 2 @ 19.40 (SKU0, line 38.80)
 *   - RETURN_LOT_SINGLE                   lot item,    qty 1 @ 19.40 (SKU1)
 *   - RETURN_LOT_MULTI                    lot item,    qty 2 @ 19.40 (SKU1, line 38.80)
 *   - RETURN_TWO_LOT_SINGLE              two lot lines, SKU0 + SKU1, each qty 1
 *   - RETURN_TWO_SERIAL_SINGLE           two serial lines, SKU0 + SKU1, each qty 1
 *   - RETURN_LOT_SERIAL_TIP             lot qty 2 (SKU0) + serial qty 2 (SKU1) + 200c tip
 *   - RETURN_LOT_SERIAL_DISCOUNT        lot + serial, both net to 14.55 (line+cart disc)
 *   - RETURN_MIXED_INV_SERIAL_LOT_SINGLE  std (SKU0) + serial (SKU0) + lot (SKU1), each qty 1
 *
 * SKU index per line is taken verbatim from the VALIDATED Batch 8 order-import
 * expected responses (serial→BOTTLE→SKU0, lot→TEST_PRODUCT→SKU1 under the current
 * fallback catalog resolution). The refund expected response mirrors each order
 * scenario's item lines exactly, with the sign flipped for the refund.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(verify-lot-serial-refund-detail) — MAIN UNCERTAINTY:
 *   Lot/serial orders carry inventory detail (lot numbers / serial numbers) on the
 *   NS cash sale. The Batch 8 ORDER-side expected responses, however, assert NO
 *   lot/serial sub-structure: `assignedInventoryDetail` and `inventoryDetails` are
 *   both empty arrays and each line asserts only Item / Quantity / Item Rate
 *   (variances = 0). We therefore do NOT invent any refund-side lot/serial values.
 *   The refund line assertion is kept to the fields proven across R0–R8
 *   (Item, Quantity, Amount, variances = 0) via buildExpectedCashRefund. Whether NS
 *   requires/echoes lot/serial inventory detail on a CASH REFUND is UNKNOWN until
 *   the live run; if it does, tighten these fixtures then.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Fixture math (validated live on R0–R8 + the R9 brief):
 *   - Product base rate 19.40. A LINE+cart discount nets INTO the item rate
 *     (LOT_SERIAL_DISCOUNT → 14.55 per the validated order fixture); no separate
 *     DIS00000 line.
 *   - A qty>1 line's NS amount = rate × qty (19.40 × 2 = 38.80).
 *   - Unit refund math (helpers/squareDataCreation.js createSquareRefund):
 *       ONE_UNIT             = round(line0.total / line0.qty)            → one unit of line 0
 *       PARTIAL_QTY (qty=N)  = round((line.total / line.qty) * min(N,qty)) on lineIndex
 *       PARTIAL_LINE_INDEX   = that line's whole total_money (all its units)
 *       HALF_AMOUNT          = floor(order.total_money / 2)
 *       FULL                 = order total_money (all lines, incl. tip)
 *   - Refund NS line Quantity is a signed unit count (refund convention): 1 unit →
 *     "-1", 2 units → "-2".
 *   - Tip is excluded from the NS transaction total and recorded as a separate Tip
 *     refundAdjustment, but only when the tip is actually refunded (FULL).
 *   - eTail Refund Exported ("F"), Payment Method (""), Location come from
 *     buildExpectedCashRefund — reused exactly as R6/R7 do. All variances = 0.
 *
 * Run: node scripts/generateSquareReturnBatch9.js
 */
const path = require("path");
const { generateReturnBatch } = require("../helpers/squareReturnBatchGenerator");
const { netRate } = require("../helpers/squareBatchGenerator");
const { REFUND_KINDS } = require("../helpers/squareReturnScenarios");

const ROOT = path.join(__dirname, "..");
const SKU0 = { sku: 0 };
const SKU1 = { sku: 1 };
const RATE = "19.40";
// LOT_SERIAL_DISCOUNT nets to 14.55 in the validated Batch 8 order fixture
// (base 19.40 less the combined line+cart discount).
const DISC_RATE = netRate(RATE, 0.25); // "14.55"

/** @param {number} sku @param {string} amount @param {string|number} qty */
function rl(sku, amount, qty = "-1") {
  return { sku, amount, qty: String(qty) };
}

const BATCH = [
  // ---- RETURN_SERIAL_SINGLE: serial item, qty 1 @ 19.40 (SKU0) ----
  {
    keyPrefix: "PRET16861",
    test: "BatchR9SerialSingleFull",
    zephyr: "PRE-T16861",
    title: "Full refund — serial item, qty 1",
    orderScenario: "RETURN_SERIAL_SINGLE",
    refundKind: REFUND_KINDS.FULL,
    // order total_money = 1940 → 19.40
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(0, `-${RATE}`)] },
  },
  {
    keyPrefix: "PRET16862",
    test: "BatchR9SerialSingleHalf",
    zephyr: "PRE-T16862",
    title: "Partial refund — 50% of serial item, qty 1",
    orderScenario: "RETURN_SERIAL_SINGLE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(1940/2) = 970 → 9.70
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.70", refundLines: [rl(0, "-9.70")] },
  },

  // ---- RETURN_SERIAL_MULTI: serial item, qty 2 @ 19.40 (SKU0, line 38.80) ----
  {
    keyPrefix: "PRET16863",
    test: "BatchR9SerialMultiOneUnit",
    zephyr: "PRE-T16863",
    title: "Unit refund — 1 of 2 units, serial item",
    orderScenario: "RETURN_SERIAL_MULTI",
    refundKind: REFUND_KINDS.ONE_UNIT,
    // round(3880/2) = 1940 → 19.40
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 2 }] },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(0, `-${RATE}`, "-1")] },
  },
  {
    keyPrefix: "PRET16864",
    test: "BatchR9SerialMultiPartialQty2",
    zephyr: "PRE-T16864",
    title: "Partial-qty refund — both units of serial qty-2 line",
    orderScenario: "RETURN_SERIAL_MULTI",
    refundKind: REFUND_KINDS.PARTIAL_QTY,
    refundQty: 2,
    // round((3880/2) * 2) = 3880 → 38.80
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 2 }] },
    expectedRefund: { totalAmount: "-38.80", refundLines: [rl(0, "-38.80", "-2")] },
  },
  {
    keyPrefix: "PRET16865",
    test: "BatchR9SerialMultiLineIndex",
    zephyr: "PRE-T16865",
    title: "Whole-line refund — serial qty-2 line (line index 0)",
    orderScenario: "RETURN_SERIAL_MULTI",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    // whole line 0 total_money = 3880 → 38.80 (both units)
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 2 }] },
    expectedRefund: { totalAmount: "-38.80", refundLines: [rl(0, "-38.80", "-2")] },
  },

  // ---- RETURN_LOT_SINGLE: lot item, qty 1 @ 19.40 (SKU1) ----
  {
    keyPrefix: "PRET16866",
    test: "BatchR9LotSingleFull",
    zephyr: "PRE-T16866",
    title: "Full refund — lot item, qty 1",
    orderScenario: "RETURN_LOT_SINGLE",
    refundKind: REFUND_KINDS.FULL,
    // order total_money = 1940 → 19.40 (lot item resolves to SKU1)
    expectedOrder: { products: [{ ...SKU1, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(1, `-${RATE}`)] },
  },
  {
    keyPrefix: "PRET16867",
    test: "BatchR9LotSingleHalf",
    zephyr: "PRE-T16867",
    title: "Partial refund — 50% of lot item, qty 1",
    orderScenario: "RETURN_LOT_SINGLE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(1940/2) = 970 → 9.70
    expectedOrder: { products: [{ ...SKU1, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.70", refundLines: [rl(1, "-9.70")] },
  },

  // ---- RETURN_LOT_MULTI: lot item, qty 2 @ 19.40 (SKU1, line 38.80) ----
  {
    keyPrefix: "PRET16868",
    test: "BatchR9LotMultiOneUnit",
    zephyr: "PRE-T16868",
    title: "Unit refund — 1 of 2 units, lot item",
    orderScenario: "RETURN_LOT_MULTI",
    refundKind: REFUND_KINDS.ONE_UNIT,
    // round(3880/2) = 1940 → 19.40
    expectedOrder: { products: [{ ...SKU1, rate: RATE, qty: 2 }] },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(1, `-${RATE}`, "-1")] },
  },
  {
    keyPrefix: "PRET16869",
    test: "BatchR9LotMultiPartialQty2",
    zephyr: "PRE-T16869",
    title: "Partial-qty refund — both units of lot qty-2 line",
    orderScenario: "RETURN_LOT_MULTI",
    refundKind: REFUND_KINDS.PARTIAL_QTY,
    refundQty: 2,
    // round((3880/2) * 2) = 3880 → 38.80
    expectedOrder: { products: [{ ...SKU1, rate: RATE, qty: 2 }] },
    expectedRefund: { totalAmount: "-38.80", refundLines: [rl(1, "-38.80", "-2")] },
  },

  // ---- RETURN_TWO_LOT_SINGLE: two lot lines, SKU0 + SKU1, each qty 1 (total 38.80) ----
  {
    keyPrefix: "PRET16870",
    test: "BatchR9TwoLotFull",
    zephyr: "PRE-T16870",
    title: "Full refund — two lot lines, qty 1 each",
    orderScenario: "RETURN_TWO_LOT_SINGLE",
    refundKind: REFUND_KINDS.FULL,
    // order total_money = 1940 + 1940 = 3880 → 38.80
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: {
      totalAmount: "-38.80",
      refundLines: [rl(0, `-${RATE}`), rl(1, `-${RATE}`)],
    },
  },
  {
    keyPrefix: "PRET16871",
    test: "BatchR9TwoLotLineIndex1",
    zephyr: "PRE-T16871",
    title: "Whole-line refund — second lot line (line index 1)",
    orderScenario: "RETURN_TWO_LOT_SINGLE",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 1,
    // whole line 1 total_money = 1940 → 19.40 on SKU1
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(1, `-${RATE}`)] },
  },

  // ---- RETURN_TWO_SERIAL_SINGLE: two serial lines, SKU0 + SKU1, each qty 1 (total 38.80) ----
  {
    keyPrefix: "PRET16872",
    test: "BatchR9TwoSerialFull",
    zephyr: "PRE-T16872",
    title: "Full refund — two serial lines, qty 1 each",
    orderScenario: "RETURN_TWO_SERIAL_SINGLE",
    refundKind: REFUND_KINDS.FULL,
    // order total_money = 1940 + 1940 = 3880 → 38.80
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: {
      totalAmount: "-38.80",
      refundLines: [rl(0, `-${RATE}`), rl(1, `-${RATE}`)],
    },
  },
  {
    keyPrefix: "PRET16873",
    test: "BatchR9TwoSerialLineIndex0",
    zephyr: "PRE-T16873",
    title: "Whole-line refund — first serial line (line index 0)",
    orderScenario: "RETURN_TWO_SERIAL_SINGLE",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    // whole line 0 total_money = 1940 → 19.40 on SKU0
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(0, `-${RATE}`)] },
  },

  // ---- RETURN_LOT_SERIAL_TIP: lot qty 2 (SKU0) + serial qty 2 (SKU1) + 200c tip ----
  {
    keyPrefix: "PRET16874",
    test: "BatchR9LotSerialTipFull",
    zephyr: "PRE-T16874",
    title: "Full refund — lot + serial qty-2 lines with tip",
    orderScenario: "RETURN_LOT_SERIAL_TIP",
    refundKind: REFUND_KINDS.FULL,
    // order total_money = 3880 + 3880 + 200 tip = 7960; NS total excludes tip
    // (-77.60), Tip recorded as a separate refundAdjustment (-2.00).
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 2 },
        { ...SKU1, rate: RATE, qty: 2 },
      ],
    },
    expectedRefund: {
      totalAmount: "-77.60",
      refundLines: [rl(0, "-38.80", "-2"), rl(1, "-38.80", "-2")],
      refundAdjustments: [{ item: "Tip", amount: "-2.00" }],
    },
  },

  // ---- RETURN_LOT_SERIAL_DISCOUNT: INTENTIONALLY OMITTED (non-deterministic per-line) ----
  // FINDING (live R9 runs): for a multi-line order with BOTH a 10% line discount (SKU0)
  // and a 10% ORDER/cart discount, the transaction TOTAL is stable (-33.17) but Square/NS
  // splits the order-level discount across the two line items unpredictably between runs
  // (run 1: SKU0=17.65/SKU1=15.52; run 2: SKU1=19.40/SKU0=13.77). Per-line rate assertions
  // are therefore flaky for this shape. This scenario is omitted until the cash-refund
  // validator supports total-only (header-level) assertion without per-line matching.
  // TODO(total-only-validation): re-add as a total=-33.17 check once supported.

  // ---- RETURN_MIXED_INV_SERIAL_LOT_SINGLE: std (SKU0) + serial (SKU0) + lot (SKU1), each qty 1 ----
  {
    keyPrefix: "PRET16876",
    test: "BatchR9MixedInvFull",
    zephyr: "PRE-T16876",
    title: "Full refund — standard + serial + lot lines, qty 1 each",
    orderScenario: "RETURN_MIXED_INV_SERIAL_LOT_SINGLE",
    refundKind: REFUND_KINDS.FULL,
    // order total_money = 1940 × 3 = 5820 → 58.20 (lines mirror the validated order
    // fixture: BOTTLE→SKU0, serial→SKU0, lot→SKU1).
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: {
      totalAmount: "-58.20",
      refundLines: [rl(0, `-${RATE}`), rl(0, `-${RATE}`), rl(1, `-${RATE}`)],
    },
  },
];

const result = generateReturnBatch(ROOT, {
  batchTag: "BatchR9",
  suiteTitle:
    "BatchR9 | Square Return/Refund — lot / serial / inventory-detail permutations (16 TCs)",
  tests: BATCH,
  outFileName: "BatchR9_LotSerial.json",
});

console.log(
  `Wrote ${result.outPath} (${result.count} TCs, ${result.interactions} interactions)`
);
