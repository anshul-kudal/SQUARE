#!/usr/bin/env node
/**
 * Discover lot/serial/modifier/gift catalog objects in Square account.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../env/E2E_Square.env") });

const token = Buffer.from(process.env["CONNECTIONS.SQUARE_TOKEN"], "base64")
  .toString("utf8")
  .replace(/^Bearer\s+/i, "");

async function search(type) {
  const res = await fetch("https://connect.squareup.com/v2/catalog/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Square-Version": "2024-01-17",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      object_types: [type],
      include_related_objects: true,
      limit: 100,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json.objects || [];
}

async function main() {
  for (const type of ["ITEM", "MODIFIER", "MODIFIER_LIST"]) {
    console.log(`\n=== ${type} ===`);
    const objs = await search(type);
    for (const o of objs) {
      const name =
        o.item_data?.name ||
        o.modifier_data?.name ||
        o.modifier_list_data?.name ||
        o.type;
      const track =
        o.item_data?.variations?.[0]?.item_variation_data?.inventory_alert_type ||
        o.item_data?.variations?.[0]?.item_variation_data?.track_inventory;
      const mods = o.item_data?.modifier_list_info?.length || 0;
      console.log(`${o.id} | ${name} | mods=${mods} | track=${track}`);
      if (o.item_data?.variations?.[0]) {
        const v = o.item_data.variations[0];
        console.log(`  variation: ${v.id} price=${v.item_variation_data?.price_money?.amount}`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
