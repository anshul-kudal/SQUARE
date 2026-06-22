/**
 * Square Return/Refund smoke scenarios — order setup + refund intent.
 * Orders always include CASH payment so Refunds API can target a payment_id.
 */
const { SCENARIOS: ORDER_SCENARIOS } = require("./squareOrderScenarios");

const PAY_CASH = { type: "CASH" };

function withPayment(scenario) {
  return { ...scenario, payment: scenario.payment || PAY_CASH };
}

/** @type {Record<string, object>} */
const RETURN_ORDER_SCENARIOS = {
  RETURN_SINGLE_LINE: withPayment(ORDER_SCENARIOS.SINGLE_LINE_BASE),
  RETURN_ROUND_UP: withPayment(ORDER_SCENARIOS.ROUND_PRICE_UP),
  RETURN_ROUND_DOWN: withPayment(ORDER_SCENARIOS.ROUND_PRICE_DOWN),
  RETURN_LINE_DISC_25: withPayment(ORDER_SCENARIOS.LINE_DISCOUNT_25),
  RETURN_LINE_CART_DISC: withPayment(ORDER_SCENARIOS.LINE_AND_CART_DISCOUNT),
  RETURN_CART_DISC_15: withPayment(ORDER_SCENARIOS.CART_DISCOUNT_15),
  RETURN_TIP_LINE: withPayment(ORDER_SCENARIOS.TIP_LINE_LEVEL),
  RETURN_LINE_DISC_TIP: withPayment(ORDER_SCENARIOS.LINE_DISCOUNT_TIP),
  RETURN_ORDER_DISC_TIP: withPayment(ORDER_SCENARIOS.ORDER_DISCOUNT_TIP),
  RETURN_MULTI_QTY: withPayment(ORDER_SCENARIOS.MULTI_QTY_SINGLE),
  RETURN_ORDER_DISC_25: withPayment(ORDER_SCENARIOS.ORDER_DISCOUNT_25),
  RETURN_CUSTOM_AMOUNT: withPayment(ORDER_SCENARIOS.CUSTOM_AMOUNT_PLUS_ITEM),
  RETURN_TWO_LINE: withPayment(ORDER_SCENARIOS.TWO_LINE_TAXABLE),
  RETURN_THREE_LINE: withPayment(ORDER_SCENARIOS.THREE_LINE),
  RETURN_LINE_DISC_TWO_LINE: withPayment(ORDER_SCENARIOS.LINE_DISC_TWO_LINE),
  RETURN_TWO_LINE_MULTI_QTY: withPayment(ORDER_SCENARIOS.TWO_LINE_MULTI_QTY),
  RETURN_ORDER_DISC_TWO_LINE: withPayment(ORDER_SCENARIOS.ORDER_DISC_TWO_LINE),
  RETURN_TIP_TWO_LINE: withPayment(ORDER_SCENARIOS.TIP_TWO_LINE),
  RETURN_LINE_DISC_MULTI_QTY: withPayment(ORDER_SCENARIOS.LINE_DISC_MULTI_QTY),
  RETURN_TWO_LINE_ONE_MODIFIER: withPayment(ORDER_SCENARIOS.TWO_LINE_ONE_MODIFIER),
  RETURN_MODIFIER: withPayment(ORDER_SCENARIOS.SINGLE_LINE_MODIFIER),
  // ── Batch R8 — customer attribution / idempotency wrappers (additive) ──
  // All wrapped order scenarios are CASH-paid (no `payment` field → withPayment
  // defaults to CASH), so refund → NS cash refund behaves exactly like R6/R7.
  RETURN_EXISTING_CUSTOMER_SINGLE: withPayment(ORDER_SCENARIOS.EXISTING_CUSTOMER_SINGLE),
  RETURN_NEW_CUSTOMER_SINGLE: withPayment(ORDER_SCENARIOS.NEW_CUSTOMER_SINGLE),
  RETURN_NEW_CUSTOMER_NO_EMAIL: withPayment(ORDER_SCENARIOS.NEW_CUSTOMER_NO_EMAIL),
  RETURN_NEW_CUSTOMER_TWO_LINE: withPayment(ORDER_SCENARIOS.NEW_CUSTOMER_TWO_LINE),
  RETURN_CUSTOMER_THREE_LINE: withPayment(ORDER_SCENARIOS.CUSTOMER_THREE_LINE),
  // ── Batch R9 — lot / serial / inventory-detail item refunds (additive) ──
  // Wraps the existing Batch 8 lot/serial order shapes; all CASH-paid (withPayment
  // defaults to CASH) so refund → NS cash refund behaves exactly like R6/R7.
  RETURN_SERIAL_SINGLE: withPayment(ORDER_SCENARIOS.SERIAL_SINGLE),
  RETURN_SERIAL_MULTI: withPayment(ORDER_SCENARIOS.SERIAL_MULTI),
  RETURN_LOT_SINGLE: withPayment(ORDER_SCENARIOS.LOT_SINGLE),
  RETURN_LOT_MULTI: withPayment(ORDER_SCENARIOS.LOT_MULTI),
  RETURN_TWO_LOT_SINGLE: withPayment(ORDER_SCENARIOS.TWO_LOT_SINGLE),
  RETURN_TWO_SERIAL_SINGLE: withPayment(ORDER_SCENARIOS.TWO_SERIAL_SINGLE),
  RETURN_LOT_SERIAL_TIP: withPayment(ORDER_SCENARIOS.LOT_SERIAL_TIP),
  RETURN_LOT_SERIAL_DISCOUNT: withPayment(ORDER_SCENARIOS.LOT_SERIAL_DISCOUNT),
  RETURN_MIXED_INV_SERIAL_LOT_SINGLE: withPayment(
    ORDER_SCENARIOS.MIXED_INV_SERIAL_LOT_SINGLE
  ),
  // ── Batch R10 — non-cash / split-tender refunds (additive) ──
  // CRITICAL: unlike R6–R9, these PRESERVE each scenario's own non-cash tender.
  // withPayment() does `scenario.payment || PAY_CASH`, so it only injects CASH when a
  // scenario has no `payment`. Every scenario below DEFINES `payment`, so its tender is kept:
  //   - GIFT_CARD_FULL          → { type: "CASH" }            (single full CASH tender; SAFEST)
  //   - MULTI_PAYMENT_CASH_CHECK→ split [CASH 0.5, CHECK 0.5] (refund hits the LAST split id)
  //   - GIFT_CARD_PARTIAL       → split [CASH 0.5, CHECK 0.5]
  //   - GIFT_CARD_PARTIAL_TIP   → split [CASH 0.5, CHECK 0.5] + 200c tip
  //   - MODIFIER_GIFT_CARD      → split [CASH 0.5, CHECK 0.5] + modifier
  // applyScenarioPayment() returns paymentIds[last] for split tenders, i.e. the CHECK leg,
  // so createSquareRefund refunds the CHECK payment (~half the order total). The "gift card"
  // names are historical: in this account real gift-card activation needs a buyer instrument,
  // so they are proxied as CASH/CHECK split tenders (see squareOrderScenarios.js).
  RETURN_MULTI_PAYMENT_CASH_CHECK: withPayment(ORDER_SCENARIOS.MULTI_PAYMENT_CASH_CHECK),
  RETURN_GIFT_CARD_PARTIAL: withPayment(ORDER_SCENARIOS.GIFT_CARD_PARTIAL),
  RETURN_GIFT_CARD_FULL: withPayment(ORDER_SCENARIOS.GIFT_CARD_FULL),
  RETURN_GIFT_CARD_PARTIAL_TIP: withPayment(ORDER_SCENARIOS.GIFT_CARD_PARTIAL_TIP),
  RETURN_MODIFIER_GIFT_CARD: withPayment(ORDER_SCENARIOS.MODIFIER_GIFT_CARD),
  // ── Batch R11 — settings / variance / export-flag refunds (additive) ──
  // All CASH-paid (withPayment defaults to CASH), so refund → NS cash refund behaves
  // like R6/R7 on the proven validation surface. NOTE: the IO-side *settings* that some
  // of these scenarios exercise on the ORDER path (modifier-as-line-item, tax-as-single-line)
  // are applied via settings0Default(<override>) in generateSquareBatches5to9.js — but the
  // return harness (helpers/squareReturnBatchGenerator.js) HARDCODES settings0Default() with
  // no override, so those setting toggles are NOT reproducible on the refund path. The wrappers
  // are still added for completeness; the generator documents which setting behaviors are NOT
  // validated (see TODO(needs-harness-support) in scripts/generateSquareReturnBatch11.js).
  RETURN_TIP_VARIANCE_CHECK: withPayment(ORDER_SCENARIOS.TIP_VARIANCE_CHECK),
  RETURN_ZERO_DOLLAR_ORDER: withPayment(ORDER_SCENARIOS.ZERO_DOLLAR_ORDER),
  RETURN_MODIFIER_LINE_ITEM_SETTING: withPayment(ORDER_SCENARIOS.MODIFIER_LINE_ITEM_SETTING),
  RETURN_MODIFIER_ADJUST_SETTING: withPayment(ORDER_SCENARIOS.MODIFIER_ADJUST_SETTING),
  RETURN_TAX_SINGLE_LINE: withPayment(ORDER_SCENARIOS.TAX_SINGLE_LINE),
};

/** Refund kinds passed to createSquareRefund via _createRefund.json */
const REFUND_KINDS = {
  FULL: "full",
  HALF_AMOUNT: "partial_half",
  PARTIAL_PCT: "partial_pct",
  FIXED_CENTS: "partial_amount",
  PARTIAL_QTY: "partial_qty",
  ONE_LINE_ESTIMATE: "partial_one_line",
  PARTIAL_LINE_INDEX: "partial_line_index",
  ONE_UNIT: "partial_one_unit",
};

module.exports = {
  RETURN_ORDER_SCENARIOS,
  REFUND_KINDS,
  PAY_CASH,
};
