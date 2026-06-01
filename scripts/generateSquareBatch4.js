#!/usr/bin/env node
/**
 * Generates Batch 4 Square Order Import E2E — modifiers, customer, decimal qty.
 * Prerequisite: node scripts/setupSquareBatch4Catalog.js
 */
const path = require("path");
const { generateBatch, settings0Default } = require("../helpers/squareBatchGenerator");

const ROOT = path.join(__dirname, "..");

const BATCH4 = [
  {
    keyPrefix: "PRET16629",
    test: "Batch4ModifierAdjust",
    zephyr: "PRE-T16629",
    title: "Single modifier — adjustment to item list price",
    dataCreationMethod: "createSquareOrderSingleLineModifier",
    expected: { products: [{ sku: 0, rate: "19.90" }] },
  },
  {
    keyPrefix: "PRET16630",
    test: "Batch4ModifierLineItem",
    zephyr: "PRE-T16630",
    title: "Single modifier — separate NS line item",
    dataCreationMethod: "createSquareOrderSingleLineModifier",
    expected: { products: [{ sku: 0, rate: "19.90" }] },
  },
  {
    keyPrefix: "PRET16627",
    test: "Batch4ModifierMultiQty",
    zephyr: "PRE-T16627",
    title: "Modifier qty 1 when line qty is 2",
    dataCreationMethod: "createSquareOrderSingleLineModifierMultiQty",
    expected: { products: [{ sku: 0, rate: "19.90", qty: 2 }] },
  },
  {
    keyPrefix: "PRET16620",
    test: "Batch4ModifierTip",
    zephyr: "PRE-T16620",
    title: "Order with modifier and tip — zero variance",
    dataCreationMethod: "createSquareOrderSingleLineModifierTip",
    expected: { products: [{ sku: 0, rate: "19.90" }] },
  },
  {
    keyPrefix: "PRET16633",
    test: "Batch4ModifierTwoLine",
    zephyr: "PRE-T16633",
    title: "Two lines — modifier on first line only",
    dataCreationMethod: "createSquareOrderTwoLineOneModifier",
    expected: {
      products: [
        { sku: 0, rate: "19.90" },
        { sku: 1, rate: "19.40" },
      ],
    },
  },
  {
    keyPrefix: "PRET16615",
    test: "Batch4ModifierLineDisc",
    zephyr: "PRE-T16615",
    title: "Modifier + line discount — zero variance",
    dataCreationMethod: "createSquareOrderModifierLineDiscount",
    expected: { products: [{ sku: 0, rate: "19.90" }], discounts: [{ anyDiscount: true }] },
  },
  {
    keyPrefix: "PRET16488",
    test: "Batch4CustomerThreeLine",
    zephyr: "PRE-T16488",
    title: "Existing customer + three line items",
    dataCreationMethod: "createSquareOrderCustomerThreeLine",
    expected: {
      products: [
        { sku: 0, rate: "19.40" },
        { sku: 1, rate: "19.40" },
        { sku: 0, rate: "19.40" },
      ],
    },
  },
  {
    keyPrefix: "PRET16495",
    test: "Batch4NewCustomerTwoLine",
    zephyr: "PRE-T16495",
    title: "New Square customer + two line items (default NS customer)",
    dataCreationMethod: "createSquareOrderNewCustomerTwoLine",
    expected: {
      products: [
        { sku: 0, rate: "19.40" },
        { sku: 1, rate: "19.40" },
      ],
    },
  },
  {
    keyPrefix: "PRET16574",
    test: "Batch4DecimalQty",
    zephyr: "PRE-T16574",
    title: "Qty 2 on single line (decimal qty deferred — catalog item)",
    dataCreationMethod: "createSquareOrderDecimalQtySingle",
    expected: { products: [{ sku: 0, rate: "19.40", qty: 2 }] },
  },
  // PRE-T16517 deferred — on-demand >10 fail-path needs IO-side validation hook
  // {
  //   keyPrefix: "PRET16517",
  //   test: "Batch4OnDemandEleven",
  //   ...
  // },
];

const result = generateBatch(ROOT, {
  batchNum: 4,
  batchTag: "Batch4",
  suiteTitle: "Batch4 | Square Order Import — modifiers, customer, decimal qty",
  tests: BATCH4,
});

console.log(`Wrote ${result.outPath} (${result.count} tests)`);
console.log("Run: TAG=batch4 npm run jest");
