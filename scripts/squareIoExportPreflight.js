#!/usr/bin/env node
/**
 * Verify Integrator.io API token can run Square connection export (required for refund indexing).
 *
 * Usage:
 *   NODE_ENV=dev SETUP=E2E_Square node scripts/squareIoExportPreflight.js
 */
const { getDataFromNodeProcess } = require("@celigo/rest-api-ia-automation");
const config = require("@celigo/rest-api-ia-automation/dist/config/config").default;
const { apiRequestWithPayload } = require("@celigo/rest-api-ia-automation/dist/src/helper/apiCalls");

async function main() {
  process.env.PWD = process.env.PWD || process.cwd();
  process.env.PBI = process.env.PBI || "SQNS";
  process.env.NODE_ENV = process.env.NODE_ENV || "dev";
  process.env.SETUP = process.env.SETUP || "E2E_Square";

  await getDataFromNodeProcess();
  config.initialize();

  const connectionId = process.env["CONNECTIONS.SQUARE"];
  if (!connectionId) {
    console.error("CONNECTIONS.SQUARE is not set");
    process.exit(1);
  }

  const res = await apiRequestWithPayload(
    "POST",
    global.baseURL,
    `/connections/${connectionId}/export`,
    {},
    global.AUTH_TOKEN,
    global.CONTENT_TYPE || "application/json"
  );

  if (res?.status >= 200 && res?.status < 300) {
    console.log(`OK: connection export permitted (HTTP ${res.status})`);
    process.exit(0);
  }

  console.error(
    [
      `FAIL: POST /connections/${connectionId}/export returned HTTP ${res?.status || "?"}`,
      res?.text || JSON.stringify(res?.body || {}),
      "",
      "Return/Refund suites need this call to index Square refunds in IO before",
      '"On-demand refund sync" can be saved (otherwise IO returns 422 not valid Refunds).',
      "",
      "Fix: In integrator.io → My account → API tokens, create a token with",
      "connection export/import (or manage connection data) permission, then update",
      "Integrator.token in env/E2E_Square.env (base64-encoded Bearer <token>).",
    ].join("\n")
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
