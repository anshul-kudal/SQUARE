#!/usr/bin/env node
/**
 * Phase B0 — generates 10 Return/Refund smoke TCs (20 interactions: order + refund each).
 * Run: node scripts/generateSquareReturnSmoke.js
 */
const path = require("path");
const { generateReturnBatch } = require("../helpers/squareReturnBatchGenerator");
const { REFUND_KINDS } = require("../helpers/squareReturnScenarios");

const ROOT = path.join(__dirname, "..");

const SKU0 = { sku: 0 };
const SKU1 = { sku: 1 };

const SMOKE = [
  {
    keyPrefix: "PRET16650",
    test: "BatchR0Smoke01",
    zephyr: "PRE-T16650",
    title: "Full refund — single line baseline",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: {
      totalAmount: "-19.40",
      refundLines: [{ ...SKU0, amount: "-19.40", qty: "-1" }],
    },
  },
  {
    keyPrefix: "PRET16651",
    test: "BatchR0Smoke02",
    zephyr: "PRE-T16651",
    title: "Partial refund — 50% of order total",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: {
      totalAmount: "-9.70",
      refundLines: [{ ...SKU0, amount: "-9.70", qty: "-1" }],
    },
  },
  {
    keyPrefix: "PRET16652",
    test: "BatchR0Smoke03",
    zephyr: "PRE-T16652",
    title: "Partial refund — fixed $5.00",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: {
      totalAmount: "-5.00",
      refundLines: [{ ...SKU0, amount: "-5.00", qty: "-1" }],
    },
  },
  {
    keyPrefix: "PRET16653",
    test: "BatchR0Smoke04",
    zephyr: "PRE-T16653",
    title: "Full refund — two taxable lines",
    orderScenario: "RETURN_TWO_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [
        { ...SKU0, rate: "19.40", qty: 1 },
        { ...SKU1, rate: "19.40", qty: 1 },
      ],
    },
    expectedRefund: {
      totalAmount: "-38.80",
      refundLines: [
        { ...SKU0, amount: "-19.40", qty: "-1" },
        { ...SKU1, amount: "-19.40", qty: "-1" },
      ],
    },
  },
  {
    keyPrefix: "PRET16654",
    test: "BatchR0Smoke05",
    zephyr: "PRE-T16654",
    title: "Partial refund — first line amount only",
    orderScenario: "RETURN_TWO_LINE",
    refundKind: REFUND_KINDS.ONE_LINE_ESTIMATE,
    expectedOrder: {
      products: [
        { ...SKU0, rate: "19.40", qty: 1 },
        { ...SKU1, rate: "19.40", qty: 1 },
      ],
    },
    expectedRefund: {
      totalAmount: "-19.40",
      refundLines: [{ ...SKU0, amount: "-19.40", qty: "-1" }],
    },
  },
  {
    keyPrefix: "PRET16655",
    test: "BatchR0Smoke06",
    zephyr: "PRE-T16655",
    title: "Full refund — line 25% discount order",
    orderScenario: "RETURN_LINE_DISC_25",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: "14.55", qty: 1 }] },
    expectedRefund: {
      totalAmount: "-14.55",
      refundLines: [{ ...SKU0, amount: "-14.55", qty: "-1" }],
    },
  },
  {
    keyPrefix: "PRET16656",
    test: "BatchR0Smoke07",
    zephyr: "PRE-T16656",
    title: "Full refund — order with tip",
    orderScenario: "RETURN_TIP_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: {
      totalAmount: "-21.40",
      refundLines: [{ ...SKU0, amount: "-19.40", qty: "-1" }],
      refundAdjustments: [{ item: "Tip", amount: "-2.00" }],
    },
  },
  {
    keyPrefix: "PRET16657",
    test: "BatchR0Smoke08",
    zephyr: "PRE-T16657",
    title: "Partial refund — one unit of qty 3",
    orderScenario: "RETURN_MULTI_QTY",
    refundKind: REFUND_KINDS.ONE_UNIT,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 3 }] },
    expectedRefund: {
      totalAmount: "-19.40",
      refundLines: [{ ...SKU0, amount: "-19.40", qty: "-1" }],
    },
  },
  {
    keyPrefix: "PRET16658",
    test: "BatchR0Smoke09",
    zephyr: "PRE-T16658",
    title: "Full refund — order-level 25% discount",
    orderScenario: "RETURN_ORDER_DISC_25",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [{ ...SKU0, rate: "19.40", qty: 1 }],
      discounts: [{ rate: "-4.85" }],
    },
    expectedRefund: {
      totalAmount: "-14.55",
      refundLines: [
        { ...SKU0, amount: "-14.55", qty: "-1" },
        { item: "DIS00000", amount: "-4.85", qty: "-1" },
      ],
    },
  },
  {
    keyPrefix: "PRET16659",
    test: "BatchR0Smoke10",
    zephyr: "PRE-T16659",
    title: "Full refund — single line with modifier",
    orderScenario: "RETURN_MODIFIER",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: "19.40", qty: 1 }] },
    expectedRefund: {
      totalAmount: "-19.40",
      refundLines: [{ ...SKU0, amount: "-19.40", qty: "-1" }],
    },
  },
];

const result = generateReturnBatch(ROOT, {
  batchTag: "BatchR0",
  suiteTitle: "BatchR0 | Square Return/Refund — Phase B0 smoke (10 TCs)",
  tests: SMOKE,
  outFileName: "BatchR0_ReturnSmoke.json",
  filterTag: "return_smoke",
});

console.log(
  `Wrote ${result.outPath} (${result.count} smoke TCs, ${result.interactions} interactions)`
);
