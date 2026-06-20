#!/usr/bin/env node
/**
 * Batch R6 — Modifier + custom-amount refund permutations (16 TCs).
 *
 * Theme: modifiers / custom-amount / zero-dollar refund coverage. Built ONLY from
 * existing RETURN_* shapes:
 *   - RETURN_MODIFIER             single catalog line + 1 modifier (+0.50 → 19.90)
 *   - RETURN_TWO_LINE_ONE_MODIFIER modifier on line 0 (SKU0 → 19.90, SKU1 → 19.40)
 *   - RETURN_CUSTOM_AMOUNT        catalog line (19.40) + custom amount line (5.00)
 *   - RETURN_LINE_DISC_25         line 25% discount (zero-dollar stand-in, see TODO)
 *
 * Fixture rules applied to every expected value (validated live on R0–R2):
 *   - Product base rate = 19.40; a single modifier adds +0.50 → 19.90.
 *   - FULL refund of a modifier line = -19.90; two-line one-modifier FULL = -39.30.
 *   - RETURN_CUSTOM_AMOUNT FULL total = catalog (19.40) + custom (5.00) = -24.40, but
 *     the refund line only covers the catalog line (-19.40) — mirrors Batch1 FullCustomAmount.
 *   - PARTIAL_LINE_INDEX refunds the WHOLE line.
 *   - eTail Refund Exported / Payment Method auto-rendered — not set here.
 *
 * Refund amount math (see helpers/squareDataCreation.js createSquareRefund):
 *   - HALF_AMOUNT  = floor(totalCents / 2)
 *   - PARTIAL_PCT  = floor(totalCents * pct)
 *   - FIXED_CENTS  = refundAmountCents
 *   - PARTIAL_LINE_INDEX = that line's total_money (whole line)
 *
 * Run: node scripts/generateSquareReturnBatch6.js
 */
const path = require("path");
const { generateReturnBatch } = require("../helpers/squareReturnBatchGenerator");
const { netRate } = require("../helpers/squareBatchGenerator");
const { REFUND_KINDS } = require("../helpers/squareReturnScenarios");

const ROOT = path.join(__dirname, "..");
const SKU0 = { sku: 0 };
const SKU1 = { sku: 1 };
const RATE = "19.40";
const MOD_RATE = "19.90"; // base 19.40 + modifier 0.50
const LINE_NET_25 = netRate("19.40", 0.25); // "14.55" — zero-dollar stand-in line value

/** @param {number} sku @param {string} amount @param {string} qty */
function rl(sku, amount, qty = "-1") {
  return { sku, amount, qty: String(qty) };
}

const BATCH = [
  // ---- RETURN_MODIFIER: single line + modifier (total 1990c → 19.90) ----
  {
    keyPrefix: "PRET16807",
    test: "BatchR6ModFull",
    zephyr: "PRE-T16807",
    title: "Full refund — single line with modifier (19.90)",
    orderScenario: "RETURN_MODIFIER",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: MOD_RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${MOD_RATE}`, refundLines: [rl(0, `-${MOD_RATE}`)] },
  },
  {
    keyPrefix: "PRET16808",
    test: "BatchR6ModHalf",
    zephyr: "PRE-T16808",
    title: "Partial refund — 50% of modifier line",
    orderScenario: "RETURN_MODIFIER",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(1990/2) = 995 → 9.95
    expectedOrder: { products: [{ ...SKU0, rate: MOD_RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.95", refundLines: [rl(0, "-9.95")] },
  },
  {
    keyPrefix: "PRET16809",
    test: "BatchR6ModPct25",
    zephyr: "PRE-T16809",
    title: "Partial refund — 25% of modifier line",
    orderScenario: "RETURN_MODIFIER",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.25,
    // floor(1990*0.25) = floor(497.5) = 497 → 4.97
    expectedOrder: { products: [{ ...SKU0, rate: MOD_RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-4.97", refundLines: [rl(0, "-4.97")] },
  },
  {
    keyPrefix: "PRET16810",
    test: "BatchR6ModFixed10",
    zephyr: "PRE-T16810",
    title: "Partial refund — $10 fixed on modifier line",
    orderScenario: "RETURN_MODIFIER",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 1000,
    expectedOrder: { products: [{ ...SKU0, rate: MOD_RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-10.00", refundLines: [rl(0, "-10.00")] },
  },
  {
    keyPrefix: "PRET16811",
    test: "BatchR6ModLineIndex",
    zephyr: "PRE-T16811",
    title: "Partial refund — whole modifier line (line index 0)",
    orderScenario: "RETURN_MODIFIER",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    // PARTIAL_LINE_INDEX refunds the WHOLE line = 1990 → 19.90
    expectedOrder: { products: [{ ...SKU0, rate: MOD_RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${MOD_RATE}`, refundLines: [rl(0, `-${MOD_RATE}`)] },
  },

  // ---- RETURN_TWO_LINE_ONE_MODIFIER: line0 mod (19.90) + line1 (19.40), total 3930c ----
  {
    keyPrefix: "PRET16812",
    test: "BatchR6TwoLineModFull",
    zephyr: "PRE-T16812",
    title: "Full refund — two lines, modifier on line 0",
    orderScenario: "RETURN_TWO_LINE_ONE_MODIFIER",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [
        { ...SKU0, rate: MOD_RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: {
      totalAmount: "-39.30",
      refundLines: [rl(0, `-${MOD_RATE}`), rl(1, `-${RATE}`)],
    },
  },
  {
    keyPrefix: "PRET16813",
    test: "BatchR6TwoLineModHalf",
    zephyr: "PRE-T16813",
    title: "Partial refund — 50% of two-line modifier order",
    orderScenario: "RETURN_TWO_LINE_ONE_MODIFIER",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(3930/2) = 1965 → 19.65 (under line0 value 19.90 → single partial line on SKU0)
    expectedOrder: {
      products: [
        { ...SKU0, rate: MOD_RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-19.65", refundLines: [rl(0, "-19.65")] },
  },
  {
    keyPrefix: "PRET16814",
    test: "BatchR6TwoLineModPct50",
    zephyr: "PRE-T16814",
    title: "Partial refund — 50% pct on two-line modifier order",
    orderScenario: "RETURN_TWO_LINE_ONE_MODIFIER",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.5,
    // floor(3930*0.5) = 1965 → 19.65
    expectedOrder: {
      products: [
        { ...SKU0, rate: MOD_RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-19.65", refundLines: [rl(0, "-19.65")] },
  },
  {
    keyPrefix: "PRET16815",
    test: "BatchR6TwoLineModL0",
    zephyr: "PRE-T16815",
    title: "Partial refund — modifier line only (line index 0)",
    orderScenario: "RETURN_TWO_LINE_ONE_MODIFIER",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    // Whole modifier line 0 = 1990 → 19.90
    expectedOrder: {
      products: [
        { ...SKU0, rate: MOD_RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: `-${MOD_RATE}`, refundLines: [rl(0, `-${MOD_RATE}`)] },
  },
  {
    keyPrefix: "PRET16816",
    test: "BatchR6TwoLineModL1",
    zephyr: "PRE-T16816",
    title: "Partial refund — plain line only (line index 1)",
    orderScenario: "RETURN_TWO_LINE_ONE_MODIFIER",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 1,
    // Whole non-modifier line 1 = 1940 → 19.40
    expectedOrder: {
      products: [
        { ...SKU0, rate: MOD_RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(1, `-${RATE}`)] },
  },

  // ---- RETURN_CUSTOM_AMOUNT: catalog 19.40 + custom 5.00, total 2440c ----
  {
    keyPrefix: "PRET16817",
    test: "BatchR6CustomFull",
    zephyr: "PRE-T16817",
    title: "Full refund — catalog line + custom amount line",
    orderScenario: "RETURN_CUSTOM_AMOUNT",
    refundKind: REFUND_KINDS.FULL,
    // FULL total = catalog + custom = 24.40, but refund line covers only the catalog
    // line (-19.40) — mirrors Batch1 FullCustomAmount.
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-24.40", refundLines: [rl(0, `-${RATE}`)] },
  },
  {
    keyPrefix: "PRET16818",
    test: "BatchR6CustomHalf",
    zephyr: "PRE-T16818",
    title: "Partial refund — 50% of catalog+custom order",
    orderScenario: "RETURN_CUSTOM_AMOUNT",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(2440/2) = 1220 → 12.20 (under catalog line 19.40 → single line on SKU0)
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-12.20", refundLines: [rl(0, "-12.20")] },
  },
  {
    keyPrefix: "PRET16819",
    test: "BatchR6CustomPct25",
    zephyr: "PRE-T16819",
    title: "Partial refund — 25% of catalog+custom order",
    orderScenario: "RETURN_CUSTOM_AMOUNT",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.25,
    // floor(2440*0.25) = floor(610) = 610 → 6.10
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-6.10", refundLines: [rl(0, "-6.10")] },
  },
  {
    keyPrefix: "PRET16820",
    test: "BatchR6CustomFixed5",
    zephyr: "PRE-T16820",
    title: "Partial refund — $5 fixed on catalog+custom order",
    orderScenario: "RETURN_CUSTOM_AMOUNT",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-5.00", refundLines: [rl(0, "-5.00")] },
  },
  {
    keyPrefix: "PRET16821",
    test: "BatchR6CustomLineIndex",
    zephyr: "PRE-T16821",
    title: "Partial refund — whole catalog line (line index 0)",
    orderScenario: "RETURN_CUSTOM_AMOUNT",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    // Whole catalog line 0 = 1940 → 19.40 (custom line is index 1)
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(0, `-${RATE}`)] },
  },

  // ---- Zero-dollar coverage ----
  // TODO(zero-dollar): RETURN_* has no zero-dollar ($0 line / 100% line discount) shape.
  // A true zero-dollar refund TC needs a dedicated zero-dollar return scenario (e.g. wrap
  // ORDER_SCENARIOS.ZERO_DOLLAR_ORDER as RETURN_ZERO_DOLLAR in helpers/squareReturnScenarios.js,
  // a shared file we must not edit here). Substituting RETURN_LINE_DISC_25 (25% line discount,
  // net line 14.55) as the closest available stand-in.
  {
    keyPrefix: "PRET16822",
    test: "BatchR6ZeroDollarStandIn",
    zephyr: "PRE-T16822",
    title: "Full refund — line 25% discount (zero-dollar stand-in)",
    orderScenario: "RETURN_LINE_DISC_25",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: LINE_NET_25, qty: 1 }] },
    expectedRefund: {
      totalAmount: `-${LINE_NET_25}`,
      refundLines: [rl(0, `-${LINE_NET_25}`)],
    },
  },
];

const result = generateReturnBatch(ROOT, {
  batchTag: "BatchR6",
  suiteTitle:
    "BatchR6 | Square Return/Refund — modifier & custom-amount permutations (16 TCs)",
  tests: BATCH,
  outFileName: "BatchR6_ModifierCustomAmount.json",
});

console.log(
  `Wrote ${result.outPath} (${result.count} TCs, ${result.interactions} interactions)`
);
