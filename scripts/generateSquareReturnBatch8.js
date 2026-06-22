#!/usr/bin/env node
/**
 * Batch R8 — Customer / on-demand / idempotency refund permutations (16 TCs).
 *
 * Theme: customer attribution on refunds + idempotent refund creation. Built ONLY
 * from existing RETURN_* shapes added in helpers/squareReturnScenarios.js (additive
 * wrappers around the proven CASH-paid customer order scenarios):
 *   - RETURN_EXISTING_CUSTOMER_SINGLE  existing customer, BOTTLE qty 1 @ 19.40 (total 19.40)
 *   - RETURN_NEW_CUSTOMER_SINGLE       new customer (with email), BOTTLE qty 1 @ 19.40
 *   - RETURN_NEW_CUSTOMER_NO_EMAIL     new customer (no email), BOTTLE qty 1 @ 19.40
 *   - RETURN_NEW_CUSTOMER_TWO_LINE     new customer, BOTTLE + TEST_PRODUCT @ 19.40 (total 38.80)
 *   - RETURN_CUSTOMER_THREE_LINE       existing customer, BOTTLE+TEST_PRODUCT+BOTTLE (total 58.20)
 *
 * Fixture math (validated live on R0–R7 + the R8 brief):
 *   - Product base rate 19.40 (PRODUCTS.0 = BOTTLE → SKU0, PRODUCTS.1 = TEST_PRODUCT → SKU1).
 *     No line/cart discount, no tip, no modifier on any R8 shape → rate stays 19.40.
 *   - A qty-1 line's NS amount = rate × 1 = 19.40; refund line Quantity is the signed
 *     unit count ("-1" per unit, refund convention — existing fixtures use "-1").
 *   - Refund amount math (see helpers/squareDataCreation.js createSquareRefund):
 *       FULL                = order total_money (every line, no tip on these shapes)
 *       HALF_AMOUNT         = floor(totalCents / 2)
 *       PARTIAL_PCT         = floor(totalCents * pct)
 *       FIXED_CENTS         = refundAmountCents
 *       PARTIAL_LINE_INDEX  = that line's whole total_money
 *   - Multi-line representation mirrors R5: FULL books one refund line per order line
 *     (incl. duplicate SKU0 lines); a partial amount that fits within line 0 books a
 *     single partial line on SKU0.
 *   - eTail Refund Exported ("F"), Payment Method (""), Location come from
 *     buildExpectedCashRefund — reused exactly as R6/R7 do. All variances = 0.
 *
 * TODO(verify-customer-field): The NS cash refund record MAY carry a customer/entity
 *   field once these customer-attributed orders flow through. buildExpectedCashRefund
 *   (helpers/squareReturnBatchGenerator.js) does NOT currently assert any customer/entity
 *   field, so R8 keeps expected fields IDENTICAL to R6/R7 and does NOT invent one. The
 *   live run should confirm whether customer attribution appears on the refund record; if
 *   it does, add the field to buildExpectedCashRefund (shared) and to these expectations.
 *
 * TODO(idempotency): True idempotency replay — sending the SAME refund twice with the
 *   same idempotency_key and asserting NetSuite created exactly ONE cash refund — is not
 *   representable with the current harness. createSquareRefund issues a single refund per
 *   interaction (the harness already generates one idempotency_key per refund), and there
 *   is no "replay the same refund payload" hook nor a "count NS records == 1" assertion.
 *   The three Idempotent* TCs below are therefore implemented as ordinary FULL refunds;
 *   their testKey/title flag the intent. Full support would need: (a) a createSquareRefund
 *   mode that re-POSTs the prior refund with the stored idempotency_key, and (b) a NS
 *   validator that asserts the cash-refund count is unchanged after the replay.
 *
 * Run: node scripts/generateSquareReturnBatch8.js
 */
const path = require("path");
const { generateReturnBatch } = require("../helpers/squareReturnBatchGenerator");
const { REFUND_KINDS } = require("../helpers/squareReturnScenarios");

const ROOT = path.join(__dirname, "..");
const SKU0 = { sku: 0 };
const SKU1 = { sku: 1 };
const RATE = "19.40";

/** @param {number} sku @param {string} amount @param {string|number} qty */
function rl(sku, amount, qty = "-1") {
  return { sku, amount, qty: String(qty) };
}

const BATCH = [
  // ---- RETURN_EXISTING_CUSTOMER_SINGLE: existing customer, single line (total 1940c) ----
  {
    keyPrefix: "PRET16841",
    test: "BatchR8ExistingCustFull",
    zephyr: "PRE-T16841",
    title: "Full refund — existing customer single line",
    orderScenario: "RETURN_EXISTING_CUSTOMER_SINGLE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(0, `-${RATE}`)] },
  },
  {
    keyPrefix: "PRET16842",
    test: "BatchR8ExistingCustHalf",
    zephyr: "PRE-T16842",
    title: "Partial refund — 50% of existing-customer single line",
    orderScenario: "RETURN_EXISTING_CUSTOMER_SINGLE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(1940/2) = 970 → 9.70
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.70", refundLines: [rl(0, "-9.70")] },
  },
  {
    keyPrefix: "PRET16843",
    test: "BatchR8ExistingCustFixed5",
    zephyr: "PRE-T16843",
    title: "Partial refund — $5 fixed on existing-customer single line",
    orderScenario: "RETURN_EXISTING_CUSTOMER_SINGLE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-5.00", refundLines: [rl(0, "-5.00")] },
  },

  // ---- RETURN_NEW_CUSTOMER_SINGLE: new customer (with email), single line ----
  {
    keyPrefix: "PRET16844",
    test: "BatchR8NewCustFull",
    zephyr: "PRE-T16844",
    title: "Full refund — new customer single line",
    orderScenario: "RETURN_NEW_CUSTOMER_SINGLE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(0, `-${RATE}`)] },
  },
  {
    keyPrefix: "PRET16845",
    test: "BatchR8NewCustPct25",
    zephyr: "PRE-T16845",
    title: "Partial refund — 25% of new-customer single line",
    orderScenario: "RETURN_NEW_CUSTOMER_SINGLE",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.25,
    // floor(1940*0.25) = floor(485) = 485 → 4.85
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-4.85", refundLines: [rl(0, "-4.85")] },
  },

  // ---- RETURN_NEW_CUSTOMER_NO_EMAIL: new customer (no email), single line ----
  {
    keyPrefix: "PRET16846",
    test: "BatchR8NewCustNoEmailFull",
    zephyr: "PRE-T16846",
    title: "Full refund — new customer (no email) single line",
    orderScenario: "RETURN_NEW_CUSTOMER_NO_EMAIL",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(0, `-${RATE}`)] },
  },
  {
    keyPrefix: "PRET16847",
    test: "BatchR8NewCustNoEmailHalf",
    zephyr: "PRE-T16847",
    title: "Partial refund — 50% of new-customer (no email) single line",
    orderScenario: "RETURN_NEW_CUSTOMER_NO_EMAIL",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(1940/2) = 970 → 9.70
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.70", refundLines: [rl(0, "-9.70")] },
  },

  // ---- RETURN_NEW_CUSTOMER_TWO_LINE: new customer, line0 + line1 @ 19.40 (total 3880c) ----
  {
    keyPrefix: "PRET16848",
    test: "BatchR8NewCustTwoLineFull",
    zephyr: "PRE-T16848",
    title: "Full refund — new customer two line",
    orderScenario: "RETURN_NEW_CUSTOMER_TWO_LINE",
    refundKind: REFUND_KINDS.FULL,
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
    keyPrefix: "PRET16849",
    test: "BatchR8NewCustTwoLineL0",
    zephyr: "PRE-T16849",
    title: "Partial refund — line 0 only (new customer two line)",
    orderScenario: "RETURN_NEW_CUSTOMER_TWO_LINE",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    // Whole line 0 = 1940 → 19.40 (SKU0)
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(0, `-${RATE}`)] },
  },
  {
    keyPrefix: "PRET16850",
    test: "BatchR8NewCustTwoLineL1",
    zephyr: "PRE-T16850",
    title: "Partial refund — line 1 only (new customer two line)",
    orderScenario: "RETURN_NEW_CUSTOMER_TWO_LINE",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 1,
    // Whole line 1 = 1940 → 19.40 (SKU1)
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(1, `-${RATE}`)] },
  },

  // ---- RETURN_CUSTOMER_THREE_LINE: existing customer, SKU0+SKU1+SKU0 @ 19.40 (total 5820c) ----
  {
    keyPrefix: "PRET16851",
    test: "BatchR8CustThreeLineFull",
    zephyr: "PRE-T16851",
    title: "Full refund — customer three line",
    orderScenario: "RETURN_CUSTOMER_THREE_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
        { ...SKU0, rate: RATE, qty: 1 },
      ],
    },
    // Three lines (line 2 is SKU0/BOTTLE per CUSTOMER_THREE_LINE composition)
    expectedRefund: {
      totalAmount: "-58.20",
      refundLines: [rl(0, `-${RATE}`), rl(1, `-${RATE}`), rl(0, `-${RATE}`)],
    },
  },
  {
    keyPrefix: "PRET16852",
    test: "BatchR8CustThreeLinePct25",
    zephyr: "PRE-T16852",
    title: "Partial refund — 25% of customer three line",
    orderScenario: "RETURN_CUSTOMER_THREE_LINE",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.25,
    // floor(5820*0.25) = 1455 → 14.55 (under line 0 value 19.40 → single partial line on SKU0)
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
        { ...SKU0, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: "-14.55", refundLines: [rl(0, "-14.55")] },
  },
  {
    keyPrefix: "PRET16853",
    test: "BatchR8CustThreeLineL1",
    zephyr: "PRE-T16853",
    title: "Partial refund — line 1 only (customer three line)",
    orderScenario: "RETURN_CUSTOMER_THREE_LINE",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 1,
    // Whole line 1 = 1940 → 19.40 (SKU1/TEST_PRODUCT)
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
        { ...SKU0, rate: RATE, qty: 1 },
      ],
    },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(1, `-${RATE}`)] },
  },

  // ---- Idempotency coverage (implemented as FULL refunds — see TODO(idempotency)) ----
  {
    keyPrefix: "PRET16854",
    test: "BatchR8IdempotentExistingFull",
    zephyr: "PRE-T16854",
    title: "Idempotent refund creation — full refund, existing customer single (one NS cash refund expected)",
    orderScenario: "RETURN_EXISTING_CUSTOMER_SINGLE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(0, `-${RATE}`)] },
  },
  {
    keyPrefix: "PRET16855",
    test: "BatchR8IdempotentNewCustFull",
    zephyr: "PRE-T16855",
    title: "Idempotent refund creation — full refund, new customer single (one NS cash refund expected)",
    orderScenario: "RETURN_NEW_CUSTOMER_SINGLE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(0, `-${RATE}`)] },
  },
  {
    keyPrefix: "PRET16856",
    test: "BatchR8IdempotentThreeLineFull",
    zephyr: "PRE-T16856",
    title: "Idempotent refund creation — full refund, customer three line (one NS cash refund expected)",
    orderScenario: "RETURN_CUSTOMER_THREE_LINE",
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
      refundLines: [rl(0, `-${RATE}`), rl(1, `-${RATE}`), rl(0, `-${RATE}`)],
    },
  },
];

const result = generateReturnBatch(ROOT, {
  batchTag: "BatchR8",
  suiteTitle:
    "BatchR8 | Square Return/Refund — customer / on-demand / idempotency permutations (16 TCs)",
  tests: BATCH,
  outFileName: "BatchR8_CustomerIdempotency.json",
});

console.log(
  `Wrote ${result.outPath} (${result.count} TCs, ${result.interactions} interactions)`
);
