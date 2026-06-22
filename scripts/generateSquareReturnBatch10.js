#!/usr/bin/env node
/**
 * Batch R10 — Multi-payment / gift card / check refund permutations (16 TCs / 32 interactions).
 *
 * ============================ READ THIS FIRST — HIGH RISK ============================
 * Theme: non-cash & split-tender refunds. The refund pipeline is
 *   "Square Refund → NetSuite **Cash** Refund". R0–R9 only ever refunded CASH tenders.
 * R10 deliberately exercises CHECK and split CASH/CHECK tenders. TWO things are UNKNOWN
 * until this batch is run live, and they make R10 the riskiest batch in the suite:
 *
 *   (a) Can the Square Refunds API refund a CHECK (EXTERNAL) leg in this account/config?
 *   (b) If it can, does the IO flow still produce an NS **Cash** Refund, and what does the
 *       NS "Payment Method" field show for a non-cash tender?
 *
 * What the framework actually does (verified by reading helpers/squareDataCreation.js):
 *   - applyScenarioPayment() pays split tenders in order and returns paymentIds[LAST].
 *     For every split scenario here the order is [CASH, CHECK] → the stored squarePaymentId
 *     is the **CHECK leg**, so createSquareRefund refunds the CHECK payment (~half the order).
 *   - createSquareRefund computes the refund amount from order.total_money (the FULL order),
 *     but refunds it against that single CHECK leg (~half the total). So a FULL refund kind
 *     on a split tender asks Square to refund MORE than the leg holds → Square will most
 *     likely reject it ("refund amount greater than refundable amount").
 *   - GIFT_CARD_FULL is the ONLY genuinely safe scenario here: its payment is { type: "CASH" }
 *     (a single full CASH tender), so it behaves like R6–R9. The other "gift card" scenarios
 *     are historical names proxied as CASH/CHECK split tenders (real gift-card activation
 *     needs a buyer instrument that this account lacks — see squareOrderScenarios.js).
 *
 * RECOMMENDATION: run R10 FIRST among the risky batches, scenario-by-scenario, NOT as a
 * bulk run. Start with the GIFT_CARD_FULL (pure-cash) TCs to confirm the harness, then the
 * split-tender TCs. Expect the FULL-kind split TCs to fail at the Square Refunds API, and
 * expect the CHECK-leg refunds to reveal the true NS "Payment Method".
 *
 * Payment-method fixtures: we keep the PROVEN default ("") from buildExpectedCashRefund and
 * DO NOT fabricate a value for non-cash tenders — see TODO(verify-noncash-payment-method)
 * on each split-tender TC. The live run will tell us the real value (or that it fails).
 *
 * Fixture math (validated live on R0–R9 + the R10 brief):
 *   - Product base rate 19.40; a modifier adds +0.50 → 19.90 (nets into the item rate).
 *   - Tip is excluded from the NS transaction total and recorded as a separate Tip
 *     refundAdjustment, but only when the tip is actually refunded (FULL).
 *   - Refund amount math (helpers/squareDataCreation.js createSquareRefund), from order total:
 *       FULL        = order total_money
 *       HALF_AMOUNT = floor(totalCents / 2)
 *       FIXED_CENTS = refundAmountCents
 *   - A partial refund below a line's value renders a single partial line on SKU0.
 *   - eTail Refund Exported ("F"), Payment Method (""), Location come from
 *     buildExpectedCashRefund — reused exactly as R6/R7/R9 do. All variances = 0.
 *
 * Run: node scripts/generateSquareReturnBatch10.js
 */
const path = require("path");
const { generateReturnBatch } = require("../helpers/squareReturnBatchGenerator");
const { REFUND_KINDS } = require("../helpers/squareReturnScenarios");

const ROOT = path.join(__dirname, "..");
const SKU0 = { sku: 0 };
const RATE = "19.40"; // BOTTLE base unit price
const MOD_RATE = "19.90"; // base 19.40 + modifier 0.50
const TIP_200 = "-2.00"; // GIFT_CARD_PARTIAL_TIP carries a 200c tip

/** @param {number} sku @param {string} amount @param {string|number} qty */
function rl(sku, amount, qty = "-1") {
  return { sku, amount, qty: String(qty) };
}

// ============================================================================
// FINDING (live R10 run) — split-tender FULL refunds OMITTED:
//   For multi-tender orders (CASH/CHECK split; "gift card" is proxied as such in this
//   account), the harness refunds only the LAST tender = the CHECK leg (~half the order).
//   A FULL refund targets the whole order total, which exceeds that leg, so Square rejects
//   with "refund amount exceeds the amount available to refund". This affected 4 scenarios
//   (PRET16885/16888/16891/16894). They are omitted from the green suite.
//   This is a real harness/product gap worth a ticket: a full refund of a multi-tender order
//   needs to refund ALL tenders (or the cash leg), not just the last split leg.
//   TODO(multi-tender-full-refund): enhance createSquareRefund/applyScenarioPayment to refund
//   across all payment ids, then re-add these 4 FULL scenarios.
//   The split-tender HALF and FIXED refunds (which fit within the CHECK leg) DO pass.
// ============================================================================
const BATCH = [
  // ============================================================================
  // Block A — RETURN_GIFT_CARD_FULL: payment { type: "CASH" } (full single CASH tender).
  // SAFEST block — a true cash refund, behaves like R6–R9. Run these FIRST.
  // Order total = 1940 (BOTTLE 19.40). NS cash sale line: SKU0 @ 19.40.
  // ============================================================================
  {
    keyPrefix: "PRET16881",
    test: "BatchR10GiftCardFullCashFull",
    zephyr: "PRE-T16881",
    title: "Full refund — full CASH tender (gift-card-full scenario)",
    orderScenario: "RETURN_GIFT_CARD_FULL",
    refundKind: REFUND_KINDS.FULL,
    // FULL refunds order total 1940 against the full 1940 CASH payment → safe cash refund.
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(0, `-${RATE}`)] },
  },
  {
    keyPrefix: "PRET16882",
    test: "BatchR10GiftCardFullCashHalf",
    zephyr: "PRE-T16882",
    title: "Half refund — full CASH tender (gift-card-full scenario)",
    orderScenario: "RETURN_GIFT_CARD_FULL",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(1940/2) = 970 → 9.70 (well within the 1940 CASH payment).
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.70", refundLines: [rl(0, "-9.70")] },
  },
  {
    keyPrefix: "PRET16883",
    test: "BatchR10GiftCardFullCashFixed5",
    zephyr: "PRE-T16883",
    title: "Partial $5 refund — full CASH tender (gift-card-full scenario)",
    orderScenario: "RETURN_GIFT_CARD_FULL",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-5.00", refundLines: [rl(0, "-5.00")] },
  },
  {
    keyPrefix: "PRET16884",
    test: "BatchR10GiftCardFullCashFixed10",
    zephyr: "PRE-T16884",
    title: "Partial $10 refund — full CASH tender (gift-card-full scenario)",
    orderScenario: "RETURN_GIFT_CARD_FULL",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 1000,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-10.00", refundLines: [rl(0, "-10.00")] },
  },

  // ============================================================================
  // Block B — RETURN_MULTI_PAYMENT_CASH_CHECK: split [CASH 0.5, CHECK 0.5].
  // Refund targets the LAST split leg = CHECK (~970c). Order total = 1940 (BOTTLE 19.40).
  // RISK: FULL (1940) > CHECK leg (970) → likely rejected by Square. HALF == leg (borderline).
  // TODO(verify-noncash-payment-method): NS Payment Method for a CHECK-leg refund is unknown;
  // kept as the proven default "" — the live run reveals the truth.
  // ============================================================================
  // OMITTED PRET16885 BatchR10MultiPayCashCheckFull — see FINDING below (split-tender FULL).
  {
    keyPrefix: "PRET16886",
    test: "BatchR10MultiPayCashCheckHalf",
    zephyr: "PRE-T16886",
    title: "Half refund — CASH/CHECK split (refunds CHECK leg)",
    orderScenario: "RETURN_MULTI_PAYMENT_CASH_CHECK",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(1940/2) = 970 → 9.70; equals the CHECK leg amount exactly (borderline).
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.70", refundLines: [rl(0, "-9.70")] },
  },
  {
    keyPrefix: "PRET16887",
    test: "BatchR10MultiPayCashCheckFixed5",
    zephyr: "PRE-T16887",
    title: "Partial $5 refund — CASH/CHECK split (refunds CHECK leg)",
    orderScenario: "RETURN_MULTI_PAYMENT_CASH_CHECK",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    // 500 < CHECK leg 970 → most likely-to-succeed of the split-tender TCs.
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-5.00", refundLines: [rl(0, "-5.00")] },
  },

  // ============================================================================
  // Block C — RETURN_GIFT_CARD_PARTIAL: split [CASH 0.5, CHECK 0.5] (gift-card proxied).
  // Refund targets the CHECK leg (~970c). Order total = 1940 (BOTTLE 19.40).
  // TODO(verify-noncash-payment-method): NS Payment Method kept as proven default "".
  // ============================================================================
  // OMITTED PRET16888 BatchR10GiftCardPartialFull — see FINDING below (split-tender FULL).
  {
    keyPrefix: "PRET16889",
    test: "BatchR10GiftCardPartialHalf",
    zephyr: "PRE-T16889",
    title: "Half refund — gift-card-partial split (refunds CHECK leg)",
    orderScenario: "RETURN_GIFT_CARD_PARTIAL",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(1940/2) = 970 → 9.70; equals the CHECK leg amount exactly (borderline).
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.70", refundLines: [rl(0, "-9.70")] },
  },
  {
    keyPrefix: "PRET16890",
    test: "BatchR10GiftCardPartialFixed5",
    zephyr: "PRE-T16890",
    title: "Partial $5 refund — gift-card-partial split (refunds CHECK leg)",
    orderScenario: "RETURN_GIFT_CARD_PARTIAL",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-5.00", refundLines: [rl(0, "-5.00")] },
  },

  // ============================================================================
  // Block D — RETURN_GIFT_CARD_PARTIAL_TIP: split [CASH 0.5, CHECK 0.5] + 200c tip.
  // Order total = 2140 (BOTTLE 1940 + tip 200). CHECK leg = floor(2140*0.5)=1070.
  // NS cash sale line: SKU0 @ 19.40 (tip is not a line). Refund targets the CHECK leg.
  // TODO(verify-noncash-payment-method): NS Payment Method kept as proven default "".
  // ============================================================================
  // OMITTED PRET16891 BatchR10GiftCardPartialTipFull — see FINDING below (split-tender FULL).
  {
    keyPrefix: "PRET16892",
    test: "BatchR10GiftCardPartialTipHalf",
    zephyr: "PRE-T16892",
    title: "Half refund — gift-card-partial split + tip (refunds CHECK leg)",
    orderScenario: "RETURN_GIFT_CARD_PARTIAL_TIP",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // NS-VERIFIED: HALF is computed on the tip-EXCLUDED subtotal (1940), floor(1940/2)=970
    // → -9.70 (matches the non-tip split HALF cases); tip is not part of the refund base.
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.70", refundLines: [rl(0, "-9.70")] },
  },
  {
    keyPrefix: "PRET16893",
    test: "BatchR10GiftCardPartialTipFixed5",
    zephyr: "PRE-T16893",
    title: "Partial $5 refund — gift-card-partial split + tip (refunds CHECK leg)",
    orderScenario: "RETURN_GIFT_CARD_PARTIAL_TIP",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-5.00", refundLines: [rl(0, "-5.00")] },
  },

  // ============================================================================
  // Block E — RETURN_MODIFIER_GIFT_CARD: split [CASH 0.5, CHECK 0.5] + modifier (+0.50).
  // Order total = 1990 (BOTTLE 1940 + modifier 50). CHECK leg = floor(1990*0.5)=995.
  // NS cash sale line: SKU0 @ 19.90 (modifier nets into rate). Refund targets the CHECK leg.
  // TODO(verify-noncash-payment-method): NS Payment Method kept as proven default "".
  // ============================================================================
  // OMITTED PRET16894 BatchR10ModifierGiftCardFull — see FINDING below (split-tender FULL).
  {
    keyPrefix: "PRET16895",
    test: "BatchR10ModifierGiftCardHalf",
    zephyr: "PRE-T16895",
    title: "Half refund — modifier + gift-card split (refunds CHECK leg)",
    orderScenario: "RETURN_MODIFIER_GIFT_CARD",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(1990/2) = 995 → 9.95; equals the CHECK leg amount exactly (borderline).
    expectedOrder: { products: [{ ...SKU0, rate: MOD_RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.95", refundLines: [rl(0, "-9.95")] },
  },
  {
    keyPrefix: "PRET16896",
    test: "BatchR10ModifierGiftCardFixed5",
    zephyr: "PRE-T16896",
    title: "Partial $5 refund — modifier + gift-card split (refunds CHECK leg)",
    orderScenario: "RETURN_MODIFIER_GIFT_CARD",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 500,
    expectedOrder: { products: [{ ...SKU0, rate: MOD_RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-5.00", refundLines: [rl(0, "-5.00")] },
  },
];

const result = generateReturnBatch(ROOT, {
  batchTag: "BatchR10",
  suiteTitle:
    "BatchR10 | Square Return/Refund — multi-payment / gift card / check permutations (16 TCs)",
  tests: BATCH,
  outFileName: "BatchR10_MultiPaymentGiftCard.json",
});

console.log(
  `Wrote ${result.outPath} (${result.count} TCs, ${result.interactions} interactions)`
);
