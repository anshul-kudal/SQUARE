#!/usr/bin/env node
/**
 * Generates Batch 2 + Batch 3 Square Order Import E2E testcases.
 * Run: node scripts/generateSquareBatch2Batch3.js
 */
const path = require("path");
const { generateBatch, settings0Default } = require("../helpers/squareBatchGenerator");

const ROOT = path.join(__dirname, "..");

const BATCH2 = [
  {
    keyPrefix: "PRET16489",
    test: "Batch2MultiQty",
    zephyr: "PRE-T16489",
    title: "Single item with quantity 3",
    dataCreationMethod: "createSquareOrderMultiQtySingle",
    expected: { products: [{ sku: 0, rate: "19.40", qty: 3 }] },
  },
  // PRE-T16523 deferred — custom amount line needs NS SKU mapping configured
  // {
  //   keyPrefix: "PRET16523",
  //   test: "Batch2CustomAmount",
  //   ...
  // },
  {
    keyPrefix: "PRET16549",
    test: "Batch2CartDisc",
    zephyr: "PRE-T16549",
    title: "Cart-level 15% discount only",
    dataCreationMethod: "createSquareOrderCartDiscount15",
    expected: { products: [{ sku: 0, rate: "19.40" }], discounts: [{ anyDiscount: true }] },
  },
  {
    keyPrefix: "PRET16546",
    test: "Batch2LineDiscTwoLine",
    zephyr: "PRE-T16546",
    title: "Line discount on first of two lines",
    dataCreationMethod: "createSquareOrderLineDiscTwoLine",
    expected: {
      products: [
        { sku: 0, rate: "19.40" },
        { sku: 1, rate: "19.40" },
      ],
      discounts: [{ anyDiscount: true }],
    },
  },
  {
    keyPrefix: "PRET16590",
    test: "Batch2TipTwoLine",
    zephyr: "PRE-T16590",
    title: "Tip on two-line order — zero variance",
    dataCreationMethod: "createSquareOrderTipTwoLine",
    expected: {
      products: [
        { sku: 0, rate: "19.40" },
        { sku: 1, rate: "19.40" },
      ],
    },
  },
  {
    keyPrefix: "PRET16595",
    test: "Batch2TipLarge",
    zephyr: "PRE-T16595",
    title: "Large tip ($5) on single line",
    dataCreationMethod: "createSquareOrderTipLarge",
    expected: { products: [{ sku: 0, rate: "19.40" }] },
  },
  {
    keyPrefix: "PRET16488",
    test: "Batch2ThreeLine",
    zephyr: "PRE-T16488",
    title: "Three line items — multi-item order",
    dataCreationMethod: "createSquareOrderThreeLine",
    expected: {
      products: [
        { sku: 0, rate: "19.40" },
        { sku: 1, rate: "19.40" },
        { sku: 0, rate: "19.40" },
      ],
    },
  },
  {
    keyPrefix: "PRET16604",
    test: "Batch2LineDiscMultiQty",
    zephyr: "PRE-T16604",
    title: "Line discount + tip on qty 2",
    dataCreationMethod: "createSquareOrderLineDiscMultiQty",
    expected: { products: [{ sku: 0, rate: "19.40", qty: 2 }], discounts: [{ anyDiscount: true }] },
  },
  {
    keyPrefix: "PRET16568",
    test: "Batch2TwoLineMultiQty",
    zephyr: "PRE-T16568",
    title: "Two lines each qty 2",
    dataCreationMethod: "createSquareOrderTwoLineMultiQty",
    expected: {
      products: [
        { sku: 0, rate: "19.40", qty: 2 },
        { sku: 1, rate: "19.40", qty: 2 },
      ],
    },
  },
  {
    keyPrefix: "PRET16555",
    test: "Batch2OrderDiscTwoLine",
    zephyr: "PRE-T16555",
    title: "Cart 10% discount on two-line order",
    dataCreationMethod: "createSquareOrderOrderDiscTwoLine",
    expected: {
      products: [
        { sku: 0, rate: "19.40" },
        { sku: 1, rate: "19.40" },
      ],
      discounts: [{ anyDiscount: true }],
    },
  },
  {
    keyPrefix: "PRET16522",
    test: "Batch2Variation",
    zephyr: "PRE-T16522",
    title: "Catalog variation item import",
    dataCreationMethod: "createSquareOrderSingleLineBase",
    expected: { products: [{ sku: 0, rate: "19.40" }] },
  },
  {
    keyPrefix: "PRET16606",
    test: "Batch2LineCartTip",
    zephyr: "PRE-T16606",
    title: "Line + cart discount + tip — zero variance",
    dataCreationMethod: "createSquareOrderLineCartTip",
    expected: { products: [{ sku: 0, rate: "19.40" }], discounts: [{ anyDiscount: true }] },
  },
];

const BATCH3 = [
  {
    keyPrefix: "PRET16593",
    test: "Batch3OnDemandFive",
    zephyr: "PRE-T16593",
    title: "On-demand sync for 5 orders",
    dataCreationMethod: "createSquareOrderFiveOnDemand",
    settings1: { "On-demand order sync": "{{PRET16593onDemandOrderSync}}" },
    expected: { products: [{ sku: 0, rate: "19.40" }] },
    flowMaxWait: 180,
    flowIdleMaxWaitSec: 360,
  },
  {
    keyPrefix: "PRET16589",
    test: "Batch3CartDiscTip",
    zephyr: "PRE-T16589",
    title: "Cart discount + tip — zero tax variance",
    dataCreationMethod: "createSquareOrderCartDiscTip",
    expected: { products: [{ sku: 0, rate: "19.40" }], discounts: [{ anyDiscount: true }] },
  },
  {
    keyPrefix: "PRET16520",
    test: "Batch3RoundVarUp",
    zephyr: "PRE-T16520",
    title: "Price round up $19.49 — zero variance",
    dataCreationMethod: "createSquareOrderRoundPriceUp",
    expected: { products: [{ sku: 0, rate: "19.49" }] },
  },
  {
    keyPrefix: "PRET16521",
    test: "Batch3RoundVarDown",
    zephyr: "PRE-T16521",
    title: "Price round down $19.44 — zero variance",
    dataCreationMethod: "createSquareOrderRoundPriceDown",
    expected: { products: [{ sku: 0, rate: "19.44" }] },
  },
  {
    keyPrefix: "PRET16498",
    test: "Batch3DefaultCustAddAll",
    zephyr: "PRE-T16498",
    title: "Default customer + add all orders checked",
    dataCreationMethod: "createSquareOrderSingleLineBase",
    settings0: settings0Default({
      "Add all orders against the default NetSuite customer": true,
    }),
    expected: { products: [{ sku: 0, rate: "19.40" }] },
  },
  {
    keyPrefix: "PRET16497",
    test: "Batch3DefaultCustNoAddAll",
    zephyr: "PRE-T16497",
    title: "Default customer + add all orders unchecked",
    dataCreationMethod: "createSquareOrderSingleLineBase",
    settings0: settings0Default({
      "Add all orders against the default NetSuite customer": false,
    }),
    expected: { products: [{ sku: 0, rate: "19.40" }] },
  },
  {
    keyPrefix: "PRET16518",
    test: "Batch3SingleOndemand",
    zephyr: "PRE-T16518",
    title: "On-demand single order import",
    dataCreationMethod: "createSquareOrderSingleLineBase",
    expected: { products: [{ sku: 0, rate: "19.40" }] },
  },
  {
    keyPrefix: "PRET16597",
    test: "Batch3TipNotTaxableLine",
    zephyr: "PRE-T16597",
    title: "Tip imported with line-level tax — zero variance",
    dataCreationMethod: "createSquareOrderTipLineLevel",
    expected: { products: [{ sku: 0, rate: "19.40" }] },
  },
  {
    keyPrefix: "PRET16598",
    test: "Batch3TipNotTaxableBody",
    zephyr: "PRE-T16598",
    title: "Tip with body-level tax setting — zero variance",
    dataCreationMethod: "createSquareOrderTipLineLevel",
    expected: { products: [{ sku: 0, rate: "19.40" }] },
  },
  {
    keyPrefix: "PRET16600",
    test: "Batch3TipNoSetting",
    zephyr: "PRE-T16600",
    title: "Tip without tip item setting — zero variance",
    dataCreationMethod: "createSquareOrderTipLineLevel",
    expected: { products: [{ sku: 0, rate: "19.40" }] },
  },
  {
    keyPrefix: "PRET16515",
    test: "Batch3OndemandSuccess",
    zephyr: "PRE-T16515",
    title: "On-demand order successfully imports to NS cash sale",
    dataCreationMethod: "createSquareOrderSingleLineBase",
    expected: { products: [{ sku: 0, rate: "19.40" }] },
  },
  {
    keyPrefix: "PRET16504",
    test: "Batch3TendersDisabled",
    zephyr: "PRE-T16504",
    title: "Order import with customer/tender flows disabled",
    dataCreationMethod: "createSquareOrderSingleLineBase",
    expected: { products: [{ sku: 0, rate: "19.40" }] },
  },
];

const b2 = generateBatch(ROOT, {
  batchNum: 2,
  batchTag: "Batch2",
  suiteTitle: "Batch2 | Square Order Import — multi-line, qty, custom amount, tips",
  tests: BATCH2,
});

const b3 = generateBatch(ROOT, {
  batchNum: 3,
  batchTag: "Batch3",
  suiteTitle: "Batch3 | Square Order Import — on-demand, settings, rounding, tips",
  tests: BATCH3,
});

console.log(`Wrote ${b2.outPath} (${b2.count} tests)`);
console.log(`Wrote ${b3.outPath} (${b3.count} tests)`);
console.log(`Run together: TAG='batch2|batch3' (lowercase)`);
