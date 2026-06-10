#!/usr/bin/env node
/**
 * Batch R2 — Multi-line, partial line, and multi-qty refunds (24 TCs).
 * Run: node scripts/generateSquareReturnBatch2.js
 */
const path = require("path");
const { generateReturnBatch } = require("../helpers/squareReturnBatchGenerator");
const { netRate } = require("../helpers/squareBatchGenerator");
const { REFUND_KINDS } = require("../helpers/squareReturnScenarios");

const ROOT = path.join(__dirname, "..");
const SKU0 = { sku: 0 };
const SKU1 = { sku: 1 };
const RATE = "19.40";
const LINE10PCT = netRate(RATE, 0.1);
const LINE25PCT = netRate(RATE, 0.25);

function rl(sku, amount, qty = "-1") {
  return { sku, amount, qty: String(qty) };
}

const BATCH = [
  {
    keyPrefix: "PRET16723",
    test: "BatchR2TwoLineFull",
    zephyr: "PRE-T16723",
    title: "Full refund — two taxable lines",
    orderScenario: "RETURN_TWO_LINE",
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
    },
  },
  {
    keyPrefix: "PRET16724",
    test: "BatchR2TwoLinePartialL0",
    zephyr: "PRE-T16724",
    title: "Partial refund — line 1 only (SKU0)",
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
    keyPrefix: "PRET16725",
    test: "BatchR2TwoLinePartialL1",
    zephyr: "PRE-T16725",
    title: "Partial refund — line 2 only (SKU1)",
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
    keyPrefix: "PRET16726",
    test: "BatchR2TwoLineHalf",
    zephyr: "PRE-T16726",
    title: "Partial refund — 50% of two-line order",
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
  {
    keyPrefix: "PRET16727",
    test: "BatchR2TwoLineFixed10",
    zephyr: "PRE-T16727",
    title: "Partial refund — $10 on two-line order",
    orderScenario: "RETURN_TWO_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 1000,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-10.00", refundLines: [rl(0, "-10.00")] },
  },
  {
    keyPrefix: "PRET16728",
    test: "BatchR2ThreeLineFull",
    zephyr: "PRE-T16728",
    title: "Full refund — three line items",
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
    keyPrefix: "PRET16729",
    test: "BatchR2ThreeLineL0",
    zephyr: "PRE-T16729",
    title: "Partial refund — first of three lines",
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
    keyPrefix: "PRET16730",
    test: "BatchR2ThreeLineL1",
    zephyr: "PRE-T16730",
    title: "Partial refund — second of three lines",
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
    keyPrefix: "PRET16731",
    test: "BatchR2ThreeLineL2",
    zephyr: "PRE-T16731",
    title: "Partial refund — third of three lines",
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
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(0, "-19.40")] },
  },
  {
    keyPrefix: "PRET16732",
    test: "BatchR2LineDisc2LFull",
    zephyr: "PRE-T16732",
    title: "Full refund — line 10% disc on line 1 of two",
    orderScenario: "RETURN_LINE_DISC_TWO_LINE",
    refundKind: REFUND_KINDS.FULL,
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
    keyPrefix: "PRET16733",
    test: "BatchR2LineDisc2LPartial",
    zephyr: "PRE-T16733",
    title: "Partial refund — discounted line only",
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
    keyPrefix: "PRET16734",
    test: "BatchR2TwoLineMqFull",
    zephyr: "PRE-T16734",
    title: "Full refund — two lines qty 2 each",
    orderScenario: "RETURN_TWO_LINE_MULTI_QTY",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 2 },
        { ...SKU1, rate: RATE, qty: 2 },
      ],
    },
    expectedRefund: {
      totalAmount: "-77.60",
      refundLines: [rl(0, "-38.80"), rl(1, "-38.80")],
    },
  },
  {
    keyPrefix: "PRET16735",
    test: "BatchR2TwoLineMqL0",
    zephyr: "PRE-T16735",
    title: "Partial refund — full amount of line 1 (qty 2)",
    orderScenario: "RETURN_TWO_LINE_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 2 },
        { ...SKU1, rate: RATE, qty: 2 },
      ],
    },
    expectedRefund: { totalAmount: "-38.80", refundLines: [rl(0, "-38.80")] },
  },
  {
    keyPrefix: "PRET16736",
    test: "BatchR2TwoLineMqUnit",
    zephyr: "PRE-T16736",
    title: "Partial refund — one unit from line 2 (qty 2)",
    orderScenario: "RETURN_TWO_LINE_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 1,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 2 },
        { ...SKU1, rate: RATE, qty: 2 },
      ],
    },
    expectedRefund: { totalAmount: "-19.40", refundLines: [rl(1, "-19.40")] },
  },
  {
    keyPrefix: "PRET16737",
    test: "BatchR2OrderDisc2LFull",
    zephyr: "PRE-T16737",
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
      refundLines: [rl(0, "-17.46"), rl(1, "-17.46")],
    },
  },
  {
    keyPrefix: "PRET16738",
    test: "BatchR2OrderDisc2LPartial",
    zephyr: "PRE-T16738",
    title: "Partial refund — line 2 on cart-disc two-line order",
    orderScenario: "RETURN_ORDER_DISC_TWO_LINE",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 1,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
      discounts: [{ anyDiscount: true }],
    },
    expectedRefund: { totalAmount: "-17.46", refundLines: [rl(1, "-17.46")] },
  },
  {
    keyPrefix: "PRET16739",
    test: "BatchR2TipTwoLineFull",
    zephyr: "PRE-T16739",
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
      totalAmount: "-42.80",
      refundLines: [rl(0, "-19.40"), rl(1, "-19.40")],
      refundAdjustments: [{ item: "Tip", amount: "-4.00" }],
    },
  },
  {
    keyPrefix: "PRET16740",
    test: "BatchR2TipTwoLineHalf",
    zephyr: "PRE-T16740",
    title: "Partial refund — 50% on tipped two-line order",
    orderScenario: "RETURN_TIP_TWO_LINE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-21.40", refundLines: [rl(0, "-19.40")] },
  },
  {
    keyPrefix: "PRET16741",
    test: "BatchR2LineDiscMqFull",
    zephyr: "PRE-T16741",
    title: "Full refund — line 25% disc qty 2 + tip",
    orderScenario: "RETURN_LINE_DISC_MULTI_QTY",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: LINE25PCT, qty: 2 }] },
    expectedRefund: {
      totalAmount: "-31.10",
      refundLines: [rl(0, `-${LINE25PCT}`, "-2")],
      refundAdjustments: [{ item: "Tip", amount: "-2.00" }],
    },
  },
  {
    keyPrefix: "PRET16742",
    test: "BatchR2LineDiscMqUnit",
    zephyr: "PRE-T16742",
    title: "Partial refund — one unit line-disc qty 2",
    orderScenario: "RETURN_LINE_DISC_MULTI_QTY",
    refundKind: REFUND_KINDS.ONE_UNIT,
    expectedOrder: { products: [{ ...SKU0, rate: LINE25PCT, qty: 2 }] },
    expectedRefund: { totalAmount: `-${LINE25PCT}`, refundLines: [rl(0, `-${LINE25PCT}`)] },
  },
  {
    keyPrefix: "PRET16743",
    test: "BatchR2TwoLineModFull",
    zephyr: "PRE-T16743",
    title: "Full refund — two lines one with modifier",
    orderScenario: "RETURN_TWO_LINE_ONE_MODIFIER",
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
    },
  },
  {
    keyPrefix: "PRET16744",
    test: "BatchR2TwoLineModL0",
    zephyr: "PRE-T16744",
    title: "Partial refund — modifier line only",
    orderScenario: "RETURN_TWO_LINE_ONE_MODIFIER",
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
    keyPrefix: "PRET16745",
    test: "BatchR2ThreeLinePct66",
    zephyr: "PRE-T16745",
    title: "Partial refund — ~66% of three-line order",
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
    expectedRefund: { totalAmount: "-38.41", refundLines: [rl(0, "-19.40")] },
  },
  {
    keyPrefix: "PRET16746",
    test: "BatchR2TwoLineMq2Units",
    zephyr: "PRE-T16746",
    title: "Partial refund — 2 units from line 1 (qty 2)",
    orderScenario: "RETURN_TWO_LINE_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_QTY,
    lineIndex: 0,
    refundQty: 2,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 2 },
        { ...SKU1, rate: RATE, qty: 2 },
      ],
    },
    expectedRefund: { totalAmount: "-38.80", refundLines: [rl(0, "-38.80", "-2")] },
  },
];

const result = generateReturnBatch(ROOT, {
  batchTag: "BatchR2",
  suiteTitle: "BatchR2 | Square Return/Refund — multi-line, partial line, qty (24 TCs)",
  tests: BATCH,
  outFileName: "BatchR2_MultiLinePartial.json",
});

console.log(
  `Wrote ${result.outPath} (${result.count} TCs, ${result.interactions} interactions)`
);
