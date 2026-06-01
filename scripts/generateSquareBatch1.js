#!/usr/bin/env node
/**
 * Generates Batch 1 Square Order Import E2E testcase + payloads/responses.
 * Run: node scripts/generateSquareBatch1.js
 */
const path = require("path");
const { generateBatch } = require("../helpers/squareBatchGenerator");

const ROOT = path.join(__dirname, "..");

const BATCH = [
  {
    keyPrefix: "PRET16506",
    test: "Batch1SingleLine",
    zephyr: "PRE-T16506",
    title: "Single line order — baseline cash sale import",
    dataCreationMethod: "createSquareOrderSingleLineBase",
    expected: { products: [{ sku: 0, rate: "19.40" }], discounts: [], requireZeroVariance: true },
    orderImportTag: false,
  },
  {
    keyPrefix: "PRET25603SC2",
    test: "Batch1LineDisc25",
    zephyr: "PRE-T16554 / PRE25603-SC2",
    title: "LINE_ITEM 25% discount — zero tax variance",
    dataCreationMethod: "createSquareOrderLineDiscount25",
    expected: {
      products: [{ sku: 0, rate: "19.40" }],
      discounts: [{ rate: "-4.85" }],
      requireZeroVariance: true,
    },
    orderImportTag: false,
  },
  {
    keyPrefix: "PRET16554",
    test: "Batch1LineCartDisc",
    zephyr: "PRE-T16554",
    title: "Line 10% + cart 15% discount on single line",
    dataCreationMethod: "createSquareOrderLineAndCartDiscount",
    expected: {
      products: [{ sku: 0, rate: "19.40" }],
      discounts: [{ rate: null, anyDiscount: true }],
      requireZeroVariance: true,
    },
    orderImportTag: false,
  },
  {
    keyPrefix: "PRET16599",
    test: "Batch1TipLine",
    zephyr: "PRE-T16599",
    title: "Tip at line level — zero variance",
    dataCreationMethod: "createSquareOrderTipLineLevel",
    expected: {
      products: [{ sku: 0, rate: "19.40" }],
      discounts: [],
      tip: true,
      requireZeroVariance: true,
    },
    orderImportTag: false,
  },
  {
    keyPrefix: "PRET16602",
    test: "Batch1LineDiscTip",
    zephyr: "PRE-T16602",
    title: "Line discount 25% + tip — zero variance",
    dataCreationMethod: "createSquareOrderLineDiscountTip",
    expected: {
      products: [{ sku: 0, rate: "19.40" }],
      discounts: [{ rate: "-4.85" }],
      tip: true,
      requireZeroVariance: true,
    },
    orderImportTag: false,
  },
  {
    keyPrefix: "PRET16605",
    test: "Batch1OrderDiscTip",
    zephyr: "PRE-T16605 / PRE-25603",
    title: "ORDER 25% discount + tip — tax variance must be zero",
    dataCreationMethod: "createSquareOrderOrderDiscountTip",
    expected: {
      products: [{ sku: 0, rate: "19.40" }],
      discounts: [{ rate: "-4.85" }],
      tip: true,
      requireZeroVariance: true,
    },
    orderImportTag: false,
  },
  {
    keyPrefix: "PRET16557",
    test: "Batch1TwoLine",
    zephyr: "PRE-T16557",
    title: "Multi-line taxable order — two catalog items",
    dataCreationMethod: "createSquareOrderTwoLineTaxable",
    expected: {
      products: [
        { sku: 0, rate: "19.40" },
        { sku: 1, rate: "19.40" },
      ],
      discounts: [],
      requireZeroVariance: true,
    },
    orderImportTag: false,
  },
  {
    keyPrefix: "PRET16511",
    test: "Batch1RoundDown",
    zephyr: "PRE-T16511",
    title: "Price rounding — $19.44 line",
    dataCreationMethod: "createSquareOrderRoundPriceDown",
    expected: { products: [{ sku: 0, rate: "19.44" }], discounts: [], requireZeroVariance: true },
    orderImportTag: false,
  },
  {
    keyPrefix: "PRET16512",
    test: "Batch1RoundUp",
    zephyr: "PRE-T16512",
    title: "Price rounding — $19.49 line",
    dataCreationMethod: "createSquareOrderRoundPriceUp",
    expected: { products: [{ sku: 0, rate: "19.49" }], discounts: [], requireZeroVariance: true },
    orderImportTag: false,
  },
  {
    keyPrefix: "PRE25603SC1",
    test: "Batch1OrderDisc25",
    zephyr: "PRE25603-SC1",
    title: "ORDER 25% discount — core PRE-25603 scenario",
    dataCreationMethod: "createSquareOrderSC1",
    expected: {
      products: [{ sku: 0, rate: "19.40" }],
      discounts: [{ rate: "-4.85" }],
      requireZeroVariance: true,
    },
    orderImportTag: false,
  },
];

const result = generateBatch(ROOT, {
  batchNum: 1,
  batchTag: "Batch1",
  suiteTitle: "Batch1 | Square Order Import — tax, discount, tip, variance regression",
  tests: BATCH,
  outFileName: "Batch1_TaxDiscountTip.json",
});

console.log(`Wrote ${result.outPath} (${result.count} tests)`);
