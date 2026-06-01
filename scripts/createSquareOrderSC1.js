#!/usr/bin/env node
/**
 * Standalone helper to create PRE25603 SC-1 Square order (ORDER-scoped 25% discount).
 *
 * Usage:
 *   NODE_ENV=dev SETUP=E2E_Square node scripts/createSquareOrderSC1.js
 */
require("dotenv").config({ path: "env/E2E_Square.env" });
const { createSquareOrderSC1 } = require("../helpers/squareDataCreation");

(async () => {
  const map = new Map();
  process.env.testCaseName = "PRE25603SC1OrderImport";
  const res = await createSquareOrderSC1({}, map);
  console.log(JSON.stringify({
    squareOrderId: map.get("PRE25603SC1squareOrderId"),
    onDemandOrderSync: map.get("PRE25603SC1onDemandOrderSync"),
    squareTotals: {
      discount: res.body.total_discount_money?.amount,
      tax: res.body.total_tax_money?.amount,
      total: res.body.total_money?.amount,
    },
  }, null, 2));
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
