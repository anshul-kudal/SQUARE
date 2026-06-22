#!/usr/bin/env node
/**
 * Batch R11 — Settings / errors / variance / export flags (12 TCs, 24 interactions).
 *
 * Theme group: the LEAST uniform refund theme. Many Zephyr "settings / error /
 * export-flag" cases are NOT pure order→refund→NS validations. This batch builds ONLY
 * what fits the existing E2E harness (order import → refund import → NS cash refund,
 * validated via the NS proxy with all variances = 0), using existing RETURN_* shapes.
 * Everything that needs a mid-flow setting toggle, an error-response assertion, or an
 * export/variance signal the current validators do not expose is enumerated below and
 * NOT fabricated.
 *
 * ── TODO(needs-harness-support): settings/error concepts NOT representable here ──
 *   1. Modifier-as-separate-NS-line-item SETTING (PRE-T16617/PRE-T16630 family):
 *      the ORDER path validates this via settings0Default(modLineItem) (base line stays
 *      19.40 + a separate modifier line item 57176). The return generator
 *      (helpers/squareReturnBatchGenerator.js) HARDCODES settings0Default() with no
 *      override, so on the refund path the modifier always folds into the rate (19.90).
 *      → BatchR11ModLineItemSetting below is a VALID modifier refund, but it validates
 *        the refund AMOUNT only, NOT the separate-line-item placement. Faithful
 *        line-item-setting validation needs the return generator to accept a settings0
 *        override (and a way to validate the separate 57176 line on the refund).
 *   2. Tax-as-single-line SETTING + per-line taxes (PRE-T16556): same hardcoded-settings0
 *      limitation, plus this account records no tax, so the "single tax line" behavior is
 *      not observable. → BatchR11TaxSingleLine* below validate the two-line + cart-discount
 *      refund math only (identical to RETURN_ORDER_DISC_TWO_LINE), NOT the tax setting.
 *   3. Zero-dollar refund (PRE-T16510): a $0 order cannot take a CASH payment (Square
 *      CreatePayment requires amount_money > 0), so there is no payment_id to refund and
 *      the refund API rejects $0. Not representable. → see TODO(zero-dollar) below; a
 *      minimal non-zero refund stands in.
 *   4. Negative-path / error-response settings cases (e.g. unknown-SKU empty-track-item
 *      422, on-demand >10 / invalid-format / wrong-location 422, re-import idempotency):
 *      these assert error statuses or skip NS validation on the ORDER path
 *      (skipNsValidation / settingsValidate in generateSquareBatches5to9.js). The return
 *      harness has no negative-path / error-assertion hook on the refund flow, and the
 *      cash-refund validator only checks a successful NS record. Not representable as a
 *      refund TC.
 *   5. eTail Refund Exported FLIP to "T": the validator only sees the flag at import time,
 *      where it is always "F" (it flips "T" only after a downstream export-back flow that
 *      is not part of import). We can ASSERT "F" (done below) but cannot drive/observe the
 *      flip to "T" — that needs a downstream export-back flow + validator support.
 *
 * Built scenarios (proven validation surface only):
 *   - RETURN_TIP_VARIANCE_CHECK  BOTTLE 19.40 + 200c tip — variance validation on refund
 *                                (all variance fields = 0); FULL records the tip as a
 *                                separate adjustment (excluded from NS total), partials do not.
 *   - RETURN_SINGLE_LINE         BOTTLE 19.40 — explicit "eTail Refund Exported" = "F"
 *                                export-flag coverage (the flag comes from
 *                                buildExpectedCashRefund); also the zero-dollar stand-in.
 *   - RETURN_MODIFIER_ADJUST_SETTING / RETURN_MODIFIER_LINE_ITEM_SETTING
 *                                BOTTLE 19.40 + 1 modifier → 19.90 (modifier nets into the
 *                                rate under the return harness's default settings).
 *   - RETURN_TAX_SINGLE_LINE     two lines 19.40 + cart 10% (net 17.46/line, total 34.92).
 *
 * Fixture math (validated live on R0–R9 + the R11 brief):
 *   - Product base rate 19.40; a single modifier adds +0.50 → 19.90.
 *   - Tip is EXCLUDED from the NS transaction total and recorded as a separate Tip
 *     refundAdjustment, but only when the tip is actually refunded (FULL). Partial/amount
 *     refunds below the tip-inclusive order total do not refund the tip → no Tip adjustment.
 *   - createSquareRefund amounts (helpers/squareDataCreation.js) operate on the order
 *     total_money (which INCLUDES tip):
 *       FULL                = order total_money
 *       HALF_AMOUNT         = max(1, floor(total_money / 2))
 *       PARTIAL_PCT         = max(1, floor(total_money * pct))
 *       FIXED_CENTS         = refundAmountCents
 *       PARTIAL_LINE_INDEX  = that line's total_money (whole line; tip is order-level)
 *   - Cart/order discount keeps the line rate and adds a separate DIS00000 line on FULL;
 *     partial refunds on cart-discount orders carry no DIS00000 line (mirrors R3).
 *   - eTail Refund Exported ("F"), Payment Method (""), Location, and all variances (= 0)
 *     come from buildExpectedCashRefund — reused exactly as R3/R6/R7.
 *
 * Run: node scripts/generateSquareReturnBatch11.js
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
const CART_10 = netRate(RATE, 0.1); // "17.46" — cart 10% per-line net
const TIP_200 = "-2.00"; // 200c tip, recorded as a refund adjustment (not in NS total)

/** @param {number} sku @param {string} amount @param {string|number} qty */
function rl(sku, amount, qty = "-1") {
  return { sku, amount, qty: String(qty) };
}

const BATCH = [
  // ──────────────────────────────────────────────────────────────────────────
  // RETURN_TIP_VARIANCE_CHECK — variance validation on refund (BOTTLE 19.40 + 200c tip).
  // Order total_money = 1940 + 200 tip = 2140. Every TC asserts all variance fields = 0.
  // ──────────────────────────────────────────────────────────────────────────
  {
    keyPrefix: "PRET16901",
    test: "BatchR11TipVarianceFull",
    zephyr: "PRE-T16901",
    title: "Full refund — tip order, all variance fields = 0 (tip as adjustment)",
    orderScenario: "RETURN_TIP_VARIANCE_CHECK",
    refundKind: REFUND_KINDS.FULL,
    // NS total excludes tip (-19.40); tip recorded as a separate adjustment (-2.00).
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: {
      totalAmount: `-${RATE}`,
      refundLines: [rl(0, `-${RATE}`)],
      refundAdjustments: [{ item: "Tip", amount: TIP_200 }],
    },
  },
  {
    keyPrefix: "PRET16902",
    test: "BatchR11TipVarianceHalf",
    zephyr: "PRE-T16902",
    title: "Half refund — tip order, variance = 0 (tip not refunded on partial)",
    orderScenario: "RETURN_TIP_VARIANCE_CHECK",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // NS-VERIFIED: HALF is computed on the tip-EXCLUDED subtotal (1940), floor(1940/2)=970
    // → -9.70 (tip is not part of the refund base).
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.70", refundLines: [rl(0, "-9.70")] },
  },
  {
    keyPrefix: "PRET16903",
    test: "BatchR11TipVariancePct25",
    zephyr: "PRE-T16903",
    title: "Partial 25% refund — tip order, variance = 0",
    orderScenario: "RETURN_TIP_VARIANCE_CHECK",
    refundKind: REFUND_KINDS.PARTIAL_PCT,
    refundPct: 0.25,
    // NS-VERIFIED: 25% is computed on the tip-EXCLUDED subtotal (1940), floor(1940*0.25)=485
    // → -4.85 (tip is not part of the refund base).
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-4.85", refundLines: [rl(0, "-4.85")] },
  },
  {
    keyPrefix: "PRET16904",
    test: "BatchR11TipVarianceLineIndex",
    zephyr: "PRE-T16904",
    title: "Whole-line refund — tip order, variance = 0 (line index 0, tip excluded)",
    orderScenario: "RETURN_TIP_VARIANCE_CHECK",
    refundKind: REFUND_KINDS.PARTIAL_LINE_INDEX,
    lineIndex: 0,
    // line 0 total_money = 1940 (tip is order-level, not on the line) → 19.40, no tip adj.
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(0, `-${RATE}`)] },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // eTail Refund Exported = "F" — export-flag coverage. These two TCs explicitly
  // document that they validate the "eTail Refund Exported" flag (rendered as "F" by
  // buildExpectedCashRefund at import time). See TODO(needs-harness-support) #5 re: the
  // "T" flip, which import cannot drive/observe.
  // ──────────────────────────────────────────────────────────────────────────
  {
    keyPrefix: "PRET16905",
    test: "BatchR11ExportFlagFull",
    zephyr: "PRE-T16905",
    title: 'Full refund — asserts eTail Refund Exported = "F" (export-flag coverage)',
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${RATE}`, refundLines: [rl(0, `-${RATE}`)] },
  },
  {
    keyPrefix: "PRET16906",
    test: "BatchR11ExportFlagHalf",
    zephyr: "PRE-T16906",
    title: 'Half refund — asserts eTail Refund Exported = "F" on a partial refund',
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(1940/2) = 970 → 9.70.
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.70", refundLines: [rl(0, "-9.70")] },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Zero-dollar refund — NOT representable (see TODO(needs-harness-support) #3).
  // TODO(zero-dollar): a $0 order cannot take a CASH payment (Square CreatePayment requires
  // amount_money > 0), so there is no payment_id to refund and the Refunds API rejects $0.
  // Substituting a minimal non-zero ($1.00 FIXED) refund on a base single line as the closest
  // representable stand-in (mirrors R6's zero-dollar stand-in approach).
  // ──────────────────────────────────────────────────────────────────────────
  {
    keyPrefix: "PRET16907",
    test: "BatchR11ZeroDollarStandIn",
    zephyr: "PRE-T16907",
    title: "Minimal $1 refund — zero-dollar stand-in (true $0 refund not representable)",
    orderScenario: "RETURN_SINGLE_LINE",
    refundKind: REFUND_KINDS.FIXED_CENTS,
    refundAmountCents: 100,
    expectedOrder: { products: [{ ...SKU0, rate: RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-1.00", refundLines: [rl(0, "-1.00")] },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Modifier SETTING refunds — modifier nets into the rate (19.90) under the return
  // harness's default settings. RETURN_MODIFIER_ADJUST_SETTING validates the
  // adjustment-to-list-price behavior faithfully. RETURN_MODIFIER_LINE_ITEM_SETTING is a
  // valid modifier refund but, per TODO(needs-harness-support) #1, it CANNOT validate the
  // separate-line-item placement on the refund path (hardcoded settings0).
  // ──────────────────────────────────────────────────────────────────────────
  {
    keyPrefix: "PRET16908",
    test: "BatchR11ModAdjustSettingFull",
    zephyr: "PRE-T16908",
    title: "Full refund — modifier as adjustment to item list price (19.90)",
    orderScenario: "RETURN_MODIFIER_ADJUST_SETTING",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: MOD_RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${MOD_RATE}`, refundLines: [rl(0, `-${MOD_RATE}`)] },
  },
  {
    keyPrefix: "PRET16909",
    test: "BatchR11ModAdjustSettingHalf",
    zephyr: "PRE-T16909",
    title: "Half refund — modifier as adjustment to item list price",
    orderScenario: "RETURN_MODIFIER_ADJUST_SETTING",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(1990/2) = 995 → 9.95.
    expectedOrder: { products: [{ ...SKU0, rate: MOD_RATE, qty: 1 }] },
    expectedRefund: { totalAmount: "-9.95", refundLines: [rl(0, "-9.95")] },
  },
  {
    keyPrefix: "PRET16910",
    test: "BatchR11ModLineItemSettingFull",
    zephyr: "PRE-T16910",
    // NOTE: validates the modifier refund AMOUNT only. The separate-NS-line-item placement
    // (settings0Default(modLineItem) → base line 19.40 + modifier line 57176) is NOT
    // reproducible on the refund path — see TODO(needs-harness-support) #1.
    title: "Full refund — modifier line-item setting (amount only; line placement not validated)",
    orderScenario: "RETURN_MODIFIER_LINE_ITEM_SETTING",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: { products: [{ ...SKU0, rate: MOD_RATE, qty: 1 }] },
    expectedRefund: { totalAmount: `-${MOD_RATE}`, refundLines: [rl(0, `-${MOD_RATE}`)] },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Tax-single-line SETTING refunds — validates the two-line + cart-10% refund math only
  // (net 17.46/line, total 34.92), identical to RETURN_ORDER_DISC_TWO_LINE. The tax-as-
  // single-line setting itself is NOT validated — see TODO(needs-harness-support) #2.
  // ──────────────────────────────────────────────────────────────────────────
  {
    keyPrefix: "PRET16911",
    test: "BatchR11TaxSingleLineFull",
    zephyr: "PRE-T16911",
    title: "Full refund — two lines + cart 10% (tax-single-line scenario; setting not validated)",
    orderScenario: "RETURN_TAX_SINGLE_LINE",
    refundKind: REFUND_KINDS.FULL,
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
      discounts: [{ anyDiscount: true }],
    },
    // order total_money = (1940 × 2) − 10% = 3492 → 34.92; two lines @ net 17.46.
    expectedRefund: {
      totalAmount: "-34.92",
      refundLines: [rl(0, `-${CART_10}`), rl(1, `-${CART_10}`)],
    },
  },
  {
    keyPrefix: "PRET16912",
    test: "BatchR11TaxSingleLineHalf",
    zephyr: "PRE-T16912",
    title: "Half refund — two lines + cart 10% (tax-single-line scenario; setting not validated)",
    orderScenario: "RETURN_TAX_SINGLE_LINE",
    refundKind: REFUND_KINDS.HALF_AMOUNT,
    // floor(3492/2) = 1746 → 17.46 (maps to the first line's net; no DIS00000 on partials).
    expectedOrder: {
      products: [
        { ...SKU0, rate: RATE, qty: 1 },
        { ...SKU1, rate: RATE, qty: 1 },
      ],
      discounts: [{ anyDiscount: true }],
    },
    expectedRefund: { totalAmount: `-${CART_10}`, refundLines: [rl(0, `-${CART_10}`)] },
  },
];

const result = generateReturnBatch(ROOT, {
  batchTag: "BatchR11",
  suiteTitle:
    "BatchR11 | Square Return/Refund — settings / errors / variance / export flags (12 TCs)",
  tests: BATCH,
  outFileName: "BatchR11_SettingsVariance.json",
});

console.log(
  `Wrote ${result.outPath} (${result.count} TCs, ${result.interactions} interactions)`
);
