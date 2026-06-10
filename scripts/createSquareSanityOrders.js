#!/usr/bin/env node
/**
 * Create Square orders for combined sanity across PRE-25603, PRE-25399, PRE-23421.
 *
 * Usage:
 *   NODE_ENV=dev SETUP=E2E_Square node scripts/createSquareSanityOrders.js
 */
require("dotenv").config({ path: "env/E2E_Square.env" });
const { createOrderForScenario } = require("../helpers/squareDataCreation");

const SANITY = [
  { id: "SAN-01", tickets: "PRE-25603 SC-1", scenario: "ORDER_DISCOUNT_25", note: "ORDER 25% discount, no tip (core bug)" },
  { id: "SAN-02", tickets: "PRE-25603", scenario: "ORDER_DISCOUNT_TIP", note: "ORDER 25% + tip — primary tax variance bug" },
  { id: "SAN-03", tickets: "PRE-25603 SC-2", scenario: "LINE_DISCOUNT_25", note: "LINE_ITEM 25% — control (Celigo_Discount_Line)" },
  { id: "SAN-04", tickets: "PRE-25603 SC-4", scenario: "LINE_AND_CART_DISCOUNT", note: "LINE 10% + ORDER 15% mixed" },
  { id: "SAN-05", tickets: "PRE-25603 SC-3", scenario: "ORDER_DISC_TWO_LINE", note: "Multi-line ORDER 10% cart discount" },
  { id: "SAN-06", tickets: "PRE-25603 SC-7 / PRE-23421", scenario: "SINGLE_LINE_BASE", note: "No discount — regression" },
  { id: "SAN-07", tickets: "PRE-25399", scenario: "CART_DISCOUNT_15", note: "ORDER 15% cart — verify with dynamic mode=true on NS discount mapping" },
  { id: "SAN-08", tickets: "PRE-23421 / PRE-25603", scenario: "TIP_LINE_LEVEL", note: "Tip only, no discount — import path sanity" },
  { id: "SAN-09", tickets: "PRE-25603", scenario: "LINE_DISCOUNT_TIP", note: "LINE_ITEM 25% + tip — control with tip" },
];

(async () => {
  const locationId = process.env["SQUARE_PRIMARY_STORE_DATA.LOCATION_ID"];
  if (!locationId) throw new Error("SQUARE_PRIMARY_STORE_DATA.LOCATION_ID missing in env");

  const results = [];
  for (const row of SANITY) {
    const map = new Map();
    const prefix = row.id.replace(/-/g, "");
    try {
      const res = await createOrderForScenario(row.scenario, map, prefix);
      const order = res.body;
      results.push({
        sanityId: row.id,
        tickets: row.tickets,
        scenario: row.scenario,
        note: row.note,
        squareOrderId: map.get(`${prefix}squareOrderId`),
        locationId,
        onDemandOrderSync: map.get(`${prefix}onDemandOrderSync`),
        squareTaxCents: order.total_tax_money?.amount,
        squareDiscountCents: order.total_discount_money?.amount,
        squareTipCents: order.total_tip_money?.amount,
        squareTotalCents: order.total_money?.amount,
      });
    } catch (err) {
      results.push({
        sanityId: row.id,
        tickets: row.tickets,
        scenario: row.scenario,
        error: err.message || String(err),
      });
    }
  }

  console.log(JSON.stringify({ locationId, orders: results }, null, 2));
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
