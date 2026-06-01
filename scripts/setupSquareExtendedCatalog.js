#!/usr/bin/env node
/**
 * Adds second modifier to Square catalog for Batch 6 multi-modifier tests.
 * Extends config/squareCatalogIds.json
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../env/E2E_Square.env") });

const OUT = path.join(__dirname, "../config/squareCatalogIds.json");
const token = Buffer.from(process.env["CONNECTIONS.SQUARE_TOKEN"], "base64")
  .toString("utf8")
  .replace(/^Bearer\s+/i, "");

async function squareRequest(method, urlPath, body) {
  const res = await fetch(`https://connect.squareup.com${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Square-Version": "2024-01-17",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

async function main() {
  let existing = {};
  if (fs.existsSync(OUT)) existing = JSON.parse(fs.readFileSync(OUT, "utf8"));

  if (existing.MODIFIER_2_ID) {
    console.log("Extended catalog already configured:", existing);
    return existing;
  }

  const modListId = existing.MODIFIER_LIST_ID;
  if (!modListId) throw new Error("Run setupSquareBatch4Catalog.js first");

  const getList = await squareRequest("GET", `/v2/catalog/object/${modListId}`);
  const modList = getList.object;
  const newModId = "#automation-mod2";
  modList.modifier_list_data.modifiers.push({
    type: "MODIFIER",
    id: newModId,
    modifier_data: {
      name: "Extra Option 2",
      price_money: { amount: 50, currency: "USD" },
    },
  });

  const upsert = await squareRequest("POST", "/v2/catalog/object", {
    idempotency_key: crypto.randomUUID(),
    object: modList,
  });

  const modifier2 = upsert.catalog_object.modifier_list_data.modifiers.find(
    (m) => m.modifier_data?.name === "Extra Option 2"
  );

  const ids = {
    ...existing,
    MODIFIER_2_ID: modifier2.id,
    MODIFIER_2_PRICE_CENTS: 50,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(OUT, JSON.stringify(ids, null, 2) + "\n");
  console.log("Wrote", OUT, ids);
  return ids;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
