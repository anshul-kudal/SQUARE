#!/usr/bin/env node
/**
 * Fetch NetSuite cash sale data for a Square eTail order id via IO NS proxy.
 *
 * Usage:
 *   NODE_ENV=dev SETUP=E2E_Square node scripts/fetchSquareNSCashSale.js LNGQJ30705K9C-1xCKgSqgVjZWOPkFuwjUnRQJueTZY
 *
 * Requires Integrator.token in env/E2E_Square.env with Connection proxy permission.
 */
const { getDataFromNodeProcess } = require("@celigo/rest-api-ia-automation");
const config = require("@celigo/rest-api-ia-automation/dist/config/config").default;
const { applySquareNsSavedSearchPatch } = require("../config/squareNsSavedSearchPatch");
const { getCashSaleFromSavedSearch, init } = require("@celigo/rest-api-ia-automation/dist/src/dataCreation/netsuite");

const orderId = process.argv[2];
if (!orderId) {
  console.error("Usage: NODE_ENV=dev SETUP=E2E_Square node scripts/fetchSquareNSCashSale.js <etailOrderId>");
  process.exit(1);
}

(async () => {
  await getDataFromNodeProcess();
  config.initialize();
  applySquareNsSavedSearchPatch();
  await init();

  const response = await getCashSaleFromSavedSearch(orderId);
  if (response.status !== 200) {
    console.error("NS proxy failed:", response.status, JSON.stringify(response.body, null, 2));
    process.exit(1);
  }

  const rows = response.body?.[0]?.results || response.body?.results || response.body;
  console.log(JSON.stringify(rows, null, 2));
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
