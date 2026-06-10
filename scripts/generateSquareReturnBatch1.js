#!/usr/bin/env node
/**
 * Batch R1 — Full / partial amount refunds on single-line orders (22 TCs).
 * Run: node scripts/generateSquareReturnBatch1.js
 */
const path = require("path");
const { generateReturnBatch } = require("../helpers/squareReturnBatchGenerator");
const { netRate, compoundNetRate } = require("../helpers/squareBatchGenerator");
const { REFUND_KINDS } = require("../helpers/squareReturnScenarios");

const ROOT = path.join(__dirname, "..");
const SKU0 = { sku: 0 };
const LINE_NET_25 = netRate("19.40", 0.25);
const LINE_CART_NET = compoundNetRate("19.40", 0.1, 0.15);
const CART_15_NET = netRate("19.40", 0.15);
const ORDER_DISC_NET = "14.55";
const DISC_485 = "-4.85";

/** @param {string} amount */
function refundLine(amount) {
  return { ...SKU0, amount, qty: "-1" };
}

const BATCH = [
  {
    keyPrefix: "PRET16701",
    test: "BatchR1FullBaseline",
    zephyr: "PRE-T16701",
    title: "Full refund — single line $19.40 (Batch1 baseline)",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: { totalAmount: "-19.40", refundLines: [refundLine("-19.40")] },
  },
  {
    keyPrefix: "PRET16702",
    test: "BatchR1FullRoundUp",
    zephyr: "PRE-T16702",
    title: "Full refund — round up $19.49",
    orderScenario: "RETURN_ROUND_UP",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: "19.49", qty: 1 }] },
    expectedRefund: { totalAmount: "-19.49", refundLines: [refundLine("-19.49")] },
  },
  {
    keyPrefix: "PRET16703",
    test: "BatchR1FullRoundDown",
    zephyr: "PRE-T16703",
    title: "Full refund — round down $19.44",
    orderScenario: "RETURN_ROUND_DOWN",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: "19.44", qty: 1 }] },
    expectedRefund: { totalAmount: "-19.44", refundLines: [refundLine("-19.44")] },
  },
  {
    keyPrefix: "PRET16704",
    test: "BatchR1Partial25Pct",
    zephyr: "PRE-T16704",
    title: "Partial refund — 25% of order total",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.25,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: { totalAmount: "-4.85", refundLines: [refundLine("-4.85")] },
  },
  {
    keyPrefix: "PRET16705",
    test: "BatchR1Partial50Pct",
    zephyr: "PRE-T16705",
    title: "Partial refund — 50% of order total",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: { totalAmount: "-9.70", refundLines: [refundLine("-9.70")] },
  },
  {
    keyPrefix: "PRET16706",
    test: "BatchR1Partial75Pct",
    zephyr: "PRE-T16706",
    title: "Partial refund — 75% of order total",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.75,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: { totalAmount: "-14.55", refundLines: [refundLine("-14.55")] },
  },
  {
    keyPrefix: "PRET16707",
    test: "BatchR1Partial1Dollar",
    zephyr: "PRE-T16707",
    title: "Partial refund — $1.00 fixed",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 100,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: { totalAmount: "-1.00", refundLines: [refundLine("-1.00")] },
  },
  {
    keyPrefix: "PRET16708",
    test: "BatchR1Partial5Dollar",
    zephyr: "PRE-T16708",
    title: "Partial refund — $5.00 fixed",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: { totalAmount: "-5.00", refundLines: [refundLine("-5.00")] },
  },
  {
    keyPrefix: "PRET16709",
    test: "BatchR1Partial10Dollar",
    zephyr: "PRE-T16709",
    title: "Partial refund — $10.00 fixed",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 1000,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: { totalAmount: "-10.00", refundLines: [refundLine("-10.00")] },
  },
  {
    keyPrefix: "PRET16710",
    test: "BatchR1Partial15Dollar",
    zephyr: "PRE-T16710",
    title: "Partial refund — $15.00 fixed",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 1500,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: { totalAmount: "-15.00", refundLines: [refundLine("-15.00")] },
  },
  {
    keyPrefix: "PRET16711",
    test: "BatchR1PartialNearFull",
    zephyr: "PRE-T16711",
    title: "Partial refund — $19.39 (near full)",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 1939,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: { totalAmount: "-19.39", refundLines: [refundLine("-19.39")] },
  },
  {
    keyPrefix: "PRET16712",
    test: "BatchR1FullLineDisc25",
    zephyr: "PRE-T16712",
    title: "Full refund — line 25% discount order",
    orderScenario: "RETURN_LINE_DISC_25",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: LINE_NET_25, qty: 1 }] },
    expectedRefund: { totalAmount: `-${LINE_NET_25}`, refundLines: [refundLine(`-${LINE_NET_25}`)] },
  },
  {
    keyPrefix: "PRET16713",
    test: "BatchR1PartialLineDisc50",
    zephyr: "PRE-T16713",
    title: "Partial refund — 50% on line-discounted order",
    orderScenario: "RETURN_LINE_DISC_25",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    expectedOrder: { products: [{ ...SKU0, rate: LINE_NET_25, qty: 1 }] },
    expectedRefund: { totalAmount: "-7.28", refundLines: [refundLine("-7.28")] },
  },
  {
    keyPrefix: "PRET16714",
    test: "BatchR1FullOrderDisc25",
    zephyr: "PRE-T16714",
    title: "Full refund — order 25% discount (PRE25603-SC1)",
    orderScenario: "RETURN_ORDER_DISC_25",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [{ ...SKU0, rate: "19.40", qty: 1 }],
      discounts: [{ rate: DISC_485 }],
    },
    expectedRefund: {
      totalAmount: `-${ORDER_DISC_NET}`,
      refundLines: [refundLine(`-${ORDER_DISC_NET}`), { item: "DIS00000", amount: DISC_485, qty: "-1" }],
    },
  },
  {
    keyPrefix: "PRET16715",
    test: "BatchR1PartialOrderDisc5",
    zephyr: "PRE-T16715",
    title: "Partial refund — $5 on order-discounted order",
    orderScenario: "RETURN_ORDER_DISC_25",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    expectedOrder: {
      products: [{ ...SKU0, rate: "19.40", qty: 1 }],
      discounts: [{ rate: DISC_485 }],
    },
    expectedRefund: { totalAmount: "-5.00", refundLines: [refundLine("-5.00")] },
  },
  {
    keyPrefix: "PRET16716",
    test: "BatchR1FullLineCartDisc",
    zephyr: "PRE-T16716",
    title: "Full refund — line 10% + cart 15% discount",
    orderScenario: "RETURN_LINE_CART_DISC",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: LINE_CART_NET, qty: 1 }] },
    expectedRefund: { totalAmount: `-${LINE_CART_NET}`, refundLines: [refundLine(`-${LINE_CART_NET}`)] },
  },
  {
    keyPrefix: "PRET16717",
    test: "BatchR1PartialLineCartDisc",
    zephyr: "PRE-T16717",
    title: "Partial refund — 50% on line+cart discount order",
    orderScenario: "RETURN_LINE_CART_DISC",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    expectedOrder: { products: [{ ...SKU0, rate: LINE_CART_NET, qty: 1 }] },
    expectedRefund: { totalAmount: "-7.42", refundLines: [refundLine("-7.42")] },
  },
  {
    keyPrefix: "PRET16718",
    test: "BatchR1FullCartDisc15",
    zephyr: "PRE-T16718",
    title: "Full refund — cart 15% discount only",
    orderScenario: "RETURN_CART_DISC_15",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: CART_15_NET, qty: 1 }] },
    expectedRefund: { totalAmount: `-${CART_15_NET}`, refundLines: [refundLine(`-${CART_15_NET}`)] },
  },
  {
    keyPrefix: "PRET16719",
    test: "BatchR1FullMultiQty3",
    zephyr: "PRE-T16719",
    title: "Full refund — multi-qty 3 single SKU",
    orderScenario: "RETURN_MULTI_QTY",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 3 }] },
    expectedRefund: { totalAmount: "-58.20", refundLines: [refundLine("-58.20")] },
  },
  {
    keyPrefix: "PRET16720",
    test: "BatchR1PartialOneUnit",
    zephyr: "PRE-T16720",
    title: "Partial refund — 1 of 3 units",
    orderScenario: "RETURN_MULTI_QTY",
    refundKind: REFUND_KINDS.ONE_UNIT,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 3 }] },
    expectedRefund: { totalAmount: "-19.40", refundLines: [refundLine("-19.40")] },
  },
  {
    keyPrefix: "PRET16721",
    test: "BatchR1PartialTwoUnits",
    zephyr: "PRE-T16721",
    title: "Partial refund — 2 of 3 units",
    orderScenario: "RETURN_MULTI_QTY",
    refundKind: REFUND_KINDS.PARTIAL_QTY,
    refundQty: 2,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 3 }] },
    expectedRefund: { totalAmount: "-38.80", refundLines: [refundLine("-38.80")] },
  },
  {
    keyPrefix: "PRET16722",
    test: "BatchR1FullCustomAmount",
    zephyr: "PRE-T16722",
    title: "Full refund — catalog line + custom amount line",
    orderScenario: "RETURN_CUSTOM_AMOUNT",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: { totalAmount: "-24.40", refundLines: [refundLine("-19.40")] },
  },
];

const result = generateReturnBatch(ROOT, {
  batchTag: "BatchR1",
  suiteTitle: "BatchR1 | Square Return/Refund — full & partial amount, single line (22 TCs)",
  tests: BATCH,
  outFileName: "BatchR1_SingleLineAmount.json",
});

console.log(
  `Wrote ${result.outPath} (${result.count} TCs, ${result.interactions} interactions)`
);
