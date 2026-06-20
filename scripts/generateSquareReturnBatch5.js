#!/usr/bin/env node
/**
 * Batch R5 — Tax-exposed multi-line refund permutations (22 TCs).
 *
 * Theme: stand-in coverage for tax-inclusive / tax-exclusive / multi-tax refund
 * behaviour. The Return order scenarios already carry standard NS tax, so these
 * permutations exercise refunds against tax-bearing orders across every refund
 * kind (FULL / HALF_AMOUNT / PARTIAL_PCT / FIXED_CENTS / PARTIAL_LINE_INDEX).
 *
 * NOTE: there is no dedicated tax-inclusive / tax-exclusive / multi-tax RETURN_*
 * shape today. Each group below uses the closest existing taxable shape and a
 * // TODO marks where a purpose-built shape would replace the stand-in. Tax
 * variance fields stay "0" — the generator emits them and they are validated 0.
 *
 * Fixture rules applied to all expected values (validated live on R0–R2):
 *   - Product base rate "19.40"; LINE disc nets into rate; CART/ORDER disc is a
 *     separate DIS00000 line (rate unchanged); MODIFIER +0.50 → "19.90".
 *   - TIP is a separate refundAdjustment, never in totalAmount.
 *   - expectedRefund.totalAmount (FULL) = net charged, negative. Tax is NOT in it.
 *   - eTail Refund Exported / Payment Method auto-rendered — not set here.
 *   - PARTIAL_LINE_INDEX refunds the WHOLE targeted line.
 *
 * Run: node scripts/generateSquareReturnBatch5.js
 */
const path = require("path");
const { generateReturnBatch } = require("../helpers/squareReturnBatchGenerator");
const { netRate } = require("../helpers/squareBatchGenerator");
const { REFUND_KINDS } = require("../helpers/squareReturnScenarios");

const ROOT = path.join(__dirname, "..");
const SKU0 = { sku: 0 };
const SKU1 = { sku: 1 };
const RATE = "19.40";
const LINE10PCT = netRate(RATE, 0.1); // 17.46 — line 10% disc nets into the rate

function rl(sku, amount, qty = "-1") {
  return { sku, amount, qty: String(qty) };
}

const BATCH = [
  // ── Group A: tax-INCLUSIVE stand-in (single + two line) ──────────────────
  // TODO: replace RETURN_SINGLE_LINE/RETURN_TWO_LINE with a true tax-inclusive
  // RETURN_* shape (price entered tax-inclusive) once one exists.
  {
    keyPrefix: "PRET16785",
    test: "BatchR5TaxInclSingleFull",
    zephyr: "PRE-T16785",
    title: "Full refund — tax-inclusive single line (stand-in)",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(0, "-19.40")] },
  },
  {
    keyPrefix: "PRET16786",
    test: "BatchR5TaxInclSingleHalf",
    zephyr: "PRE-T16786",
    title: "50% refund — tax-inclusive single line (stand-in)",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.70", refundLines: [rl(0, "-9.70")] },
  },
  {
    keyPrefix: "PRET16787",
    test: "BatchR5TaxInclSinglePct40",
    zephyr: "PRE-T16787",
    title: "40% refund — tax-inclusive single line (stand-in)",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.4,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-7.76", refundLines: [rl(0, "-7.76")] },
  },
  {
    keyPrefix: "PRET16788",
    test: "BatchR5TaxInclSingleFixed5",
    zephyr: "PRE-T16788",
    title: "$5 fixed refund — tax-inclusive single line (stand-in)",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-5.00", refundLines: [rl(0, "-5.00")] },
  },
  {
    keyPrefix: "PRET16789",
    test: "BatchR5TaxInclTwoLineFull",
    zephyr: "PRE-T16789",
    title: "Full refund — tax-inclusive two line (stand-in)",
    orderScenario: "RETURN_TWO_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-38.80", refundLines: [rl(0, "-19.40"), rl(1, "-19.40")] },
  },
  {
    keyPrefix: "PRET16790",
    test: "BatchR5TaxInclTwoLineHalf",
    zephyr: "PRE-T16790",
    title: "50% refund — tax-inclusive two line (stand-in)",
    orderScenario: "RETURN_TWO_LINE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    // Half of 38.80 == one whole line (19.40); booked as a single refund line.
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(0, "-19.40")] },
  },
  {
    keyPrefix: "PRET16791",
    test: "BatchR5TaxInclTwoLineL0",
    zephyr: "PRE-T16791",
    title: "Line-1 refund — tax-inclusive two line (stand-in)",
    orderScenario: "RETURN_TWO_LINE",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(0, "-19.40")] },
  },
  {
    keyPrefix: "PRET16792",
    test: "BatchR5TaxInclTwoLineFixed12",
    zephyr: "PRE-T16792",
    title: "$12 fixed refund — tax-inclusive two line (stand-in)",
    orderScenario: "RETURN_TWO_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 1200,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-12.00", refundLines: [rl(0, "-12.00")] },
  },

  // ── Group B: tax-EXCLUSIVE stand-in (two + three line + single) ───────────
  // TODO: replace with a true tax-exclusive RETURN_* shape (tax added on top of
  // an entered net price) once one exists.
  {
    keyPrefix: "PRET16793",
    test: "BatchR5TaxExclTwoLineFull",
    zephyr: "PRE-T16793",
    title: "Full refund — tax-exclusive two line (stand-in)",
    orderScenario: "RETURN_TWO_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-38.80", refundLines: [rl(0, "-19.40"), rl(1, "-19.40")] },
  },
  {
    keyPrefix: "PRET16794",
    test: "BatchR5TaxExclTwoLineL1",
    zephyr: "PRE-T16794",
    title: "Line-2 refund — tax-exclusive two line (stand-in)",
    orderScenario: "RETURN_TWO_LINE",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 1,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(1, "-19.40")] },
  },
  {
    keyPrefix: "PRET16795",
    test: "BatchR5TaxExclTwoLineFixed20",
    zephyr: "PRE-T16795",
    title: "$20 fixed refund — tax-exclusive two line (stand-in)",
    orderScenario: "RETURN_TWO_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 2000,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-20.00", refundLines: [rl(0, "-20.00")] },
  },
  {
    keyPrefix: "PRET16796",
    test: "BatchR5TaxExclThreeLineFull",
    zephyr: "PRE-T16796",
    title: "Full refund — tax-exclusive three line (stand-in)",
    orderScenario: "RETURN_THREE_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
        { ...SKU0, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: {
      totalAmount: "-58.20",
      refundLines: [rl(0, "-19.40"), rl(1, "-19.40"), rl(0, "-19.40")],
    },
  },
  {
    keyPrefix: "PRET16797",
    test: "BatchR5TaxExclThreeLineL2",
    zephyr: "PRE-T16797",
    title: "Line-3 refund — tax-exclusive three line (stand-in)",
    orderScenario: "RETURN_THREE_LINE",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 2,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
        { ...SKU0, rate: RATE, qty: 1 },
      ],
    },
    // Third line is SKU0 (BOTTLE) per RETURN_THREE_LINE composition.
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(0, "-19.40")] },
  },
  {
    keyPrefix: "PRET16798",
    test: "BatchR5TaxExclSingleFull",
    zephyr: "PRE-T16798",
    title: "Full refund — tax-exclusive single line (stand-in)",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(0, "-19.40")] },
  },

  // ── Group C: multi-tax stand-in (three line + line-disc two line) ─────────
  // TODO: replace with a true multi-tax RETURN_* shape (lines carrying distinct
  // tax codes / rates) once one exists.
  {
    keyPrefix: "PRET16799",
    test: "BatchR5MultiTaxThreeFull",
    zephyr: "PRE-T16799",
    title: "Full refund — multi-tax three line (stand-in)",
    orderScenario: "RETURN_THREE_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
        { ...SKU0, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: {
      totalAmount: "-58.20",
      refundLines: [rl(0, "-19.40"), rl(1, "-19.40"), rl(0, "-19.40")],
    },
  },
  {
    keyPrefix: "PRET16800",
    test: "BatchR5MultiTaxThreeL0",
    zephyr: "PRE-T16800",
    title: "Line-1 refund — multi-tax three line (stand-in)",
    orderScenario: "RETURN_THREE_LINE",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
        { ...SKU0, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(0, "-19.40")] },
  },
  {
    keyPrefix: "PRET16801",
    test: "BatchR5MultiTaxThreeL1",
    zephyr: "PRE-T16801",
    title: "Line-2 refund — multi-tax three line (stand-in)",
    orderScenario: "RETURN_THREE_LINE",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 1,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
        { ...SKU0, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(1, "-19.40")] },
  },
  {
    keyPrefix: "PRET16802",
    test: "BatchR5MultiTaxThreePct66",
    zephyr: "PRE-T16802",
    title: "~66% refund — multi-tax three line (stand-in)",
    orderScenario: "RETURN_THREE_LINE",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.66,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
        { ...SKU0, rate: RATE, qty: 1 },
      ],
    },
    // 0.66 × 58.20 = 38.41 total; Square books a single whole-line refund line.
    expectedRefund: { totalAmount: "-38.41", refundLines: [rl(0, "-19.40")] },
  },
  {
    keyPrefix: "PRET16803",
    test: "BatchR5MultiTaxThreeFixed25",
    zephyr: "PRE-T16803",
    title: "$25 fixed refund — multi-tax three line (stand-in)",
    orderScenario: "RETURN_THREE_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 2500,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
        { ...SKU0, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-25.00", refundLines: [rl(0, "-25.00")] },
  },
  {
    keyPrefix: "PRET16804",
    test: "BatchR5MultiTaxLineDiscTwoFull",
    zephyr: "PRE-T16804",
    title: "Full refund — multi-tax line-disc two line (stand-in)",
    orderScenario: "RETURN_LINE_DISC_TWO_LINE",
    refundKind: REFUND_KINDS.FULL,
    // Line 0 carries a 10% line discount that nets into the rate (17.46).
    expectedOrder: {
      products: [
        { ...SKU0, rate: LINE10PCT, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: {
      totalAmount: "-36.86",
      refundLines: [rl(0, `-${LINE10PCT}`), rl(1, "-19.40")],
    },
  },
  {
    keyPrefix: "PRET16805",
    test: "BatchR5MultiTaxLineDiscTwoL0",
    zephyr: "PRE-T16805",
    title: "Discounted-line refund — multi-tax line-disc two line (stand-in)",
    orderScenario: "RETURN_LINE_DISC_TWO_LINE",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    expectedOrder: {
      products: [
        { ...SKU0, rate: LINE10PCT, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: `-${LINE10PCT}`, refundLines: [rl(0, `-${LINE10PCT}`)] },
  },
  {
    keyPrefix: "PRET16806",
    test: "BatchR5MultiTaxTwoLineHalf",
    zephyr: "PRE-T16806",
    title: "50% refund — multi-tax two line (stand-in)",
    orderScenario: "RETURN_TWO_LINE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(0, "-19.40")] },
  },
];

const result = generateReturnBatch(ROOT, {
  batchTag: "BatchR5",
  suiteTitle:
    "BatchR5 | Square Return/Refund — tax-exposed multi-line permutations (22 TCs)",
  tests: BATCH,
  outFileName: "BatchR5_TaxMultiLine.json",
});

console.log(
  `Wrote ${result.outPath} (${result.count} TCs, ${result.interactions} interactions)`
);
