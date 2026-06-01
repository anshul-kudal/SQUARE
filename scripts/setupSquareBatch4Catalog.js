#!/usr/bin/env node
/**
 * Creates Square modifier catalog for Batch 4 automation.
 * Writes IDs to config/squareCatalogIds.json
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

  if (existing.MODIFIER_LIST_ID && existing.MODIFIER_ID) {
    console.log("Catalog already configured:", existing);
    return existing;
  }

  const idem = crypto.randomUUID();
  const upsert = await squareRequest("POST", "/v2/catalog/object", {
    idempotency_key: idem,
    object: {
      type: "MODIFIER_LIST",
      id: "#automation-modlist",
      modifier_list_data: {
        name: "Automation Modifiers",
        selection_type: "SINGLE",
        modifiers: [
          {
            type: "MODIFIER",
            id: "#automation-mod1",
            modifier_data: {
              name: "Extra Option",
              price_money: { amount: 50, currency: "USD" },
            },
          },
        ],
      },
    },
  });

  const modList = upsert.catalog_object;
  const modifier = modList.modifier_list_data.modifiers[0];
  const bottleId = process.env["SQUARE_CATALOG.BOTTLE_ITEM_ID"];

  const getItem = await squareRequest("GET", `/v2/catalog/object/${bottleId}`);
  const item = getItem.object;
  const modInfo = {
    modifier_list_id: modList.id,
    min_selected_modifiers: 0,
    max_selected_modifiers: 1,
    enabled: true,
  };
  item.item_data.modifier_list_info = [...(item.item_data.modifier_list_info || []), modInfo];

  await squareRequest("POST", "/v2/catalog/object", {
    idempotency_key: crypto.randomUUID(),
    object: item,
  });

  const ids = {
    MODIFIER_LIST_ID: modList.id,
    MODIFIER_ID: modifier.id,
    MODIFIER_NAME: modifier.modifier_data.name,
    MODIFIER_PRICE_CENTS: 50,
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
