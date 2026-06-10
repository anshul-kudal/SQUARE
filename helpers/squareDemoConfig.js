/**
 * Square live-demo test cases (5 TCs) — run via scripts/runSquareDemo.sh
 */
const DEMO_LOG = "/tmp/square_demo_run.log";
const DEMO_MANIFEST = "/tmp/square_demo_manifest.json";

const DEMO_TCS = [
  {
    num: 1,
    key: "Batch1SingleLine",
    zephyr: "PRE-T16506",
    batch: 1,
    tag: "batch1",
    desc: "Single line baseline — 1 product, cash payment",
    handler: "createSquareOrderSingleLineBase",
    payloadDir: "test-data/Square_Suite/Order_Import/Batch1/PRET16506",
    validates:
      "Item, Qty (1), Rate (19.40), eTail Order Id, eTail Channel, all variances = 0",
    estTime: "~90s",
  },
  {
    num: 2,
    key: "Batch1LineDisc25",
    zephyr: "PRE-T16554",
    batch: 1,
    tag: "batch1",
    desc: "25% line discount — product + DIS00000 discount line (-4.85)",
    handler: "createSquareOrderLineDiscount25",
    payloadDir: "test-data/Square_Suite/Order_Import/Batch1/PRET25603SC2",
    validates: "2 NS lines (product + discount), all variances = 0",
    estTime: "~90–120s",
  },
  {
    num: 3,
    key: "Batch5MultiPayment",
    zephyr: "PRE-T16507",
    batch: 5,
    tag: "batch5",
    desc: "Cash + Check split payment mapping",
    handler: "createSquareOrderMultiPayment",
    payloadDir: "test-data/Square_Suite/Order_Import/Batch5/PRET16507",
    validates: "Payment mapping, line item, eTail Order Id, variances = 0",
    estTime: "~90s",
  },
  {
    num: 4,
    key: "Batch7GiftPartialTip",
    zephyr: "PRE-T16594",
    batch: 7,
    tag: "batch7",
    desc: "Gift card partial payment + tip unaffected",
    handler: "createSquareOrderGiftCardPartialTip",
    payloadDir: "test-data/Square_Suite/Order_Import/Batch7/PRET16594",
    validates: "Gift card flow, tip handling, eTail linkage, variances = 0",
    estTime: "~90s",
  },
  {
    num: 5,
    key: "Batch4ModifierLineDisc",
    zephyr: "PRE-T16615",
    batch: 4,
    tag: "batch4",
    desc: "Modifier on line + line discount",
    handler: "createSquareOrderModifierLineDiscount",
    payloadDir: "test-data/Square_Suite/Order_Import/Batch4/PRET16615",
    validates: "Modifier line, discount, NS cash sale lines, variances = 0",
    estTime: "~60–90s",
  },
];

const ORDINAL_TO_NUM = [
  [/\b(first|1st|one)\b/gi, 1],
  [/\b(second|2nd|two)\b/gi, 2],
  [/\b(third|3rd|three)\b/gi, 3],
  [/\b(fourth|4th|four)\b/gi, 4],
  [/\b(fifth|5th|five)\b/gi, 5],
];

/** Numeric / comma / range selection: "1", "1-2", "1,3", "all" */
function resolveDemoSelection(arg) {
  const a = String(arg || "1").trim().toLowerCase();
  if (a === "all") return [...DEMO_TCS];
  if (a.includes("-") && /^\d+\s*-\s*\d+$/.test(a.replace(/\s/g, ""))) {
    const parts = a.split("-").map((x) => Number(x.trim()));
    const lo = Math.min(parts[0], parts[1]);
    const hi = Math.max(parts[0], parts[1]);
    return DEMO_TCS.filter((t) => t.num >= lo && t.num <= hi);
  }
  if (a.includes(",")) {
    const nums = new Set(a.split(",").map((x) => Number(x.trim())));
    return DEMO_TCS.filter((t) => nums.has(t.num));
  }
  const n = Number(a);
  if (Number.isNaN(n)) return [];
  return DEMO_TCS.filter((t) => t.num === n);
}

/**
 * Parse natural-language demo requests, e.g.:
 *   "run TC 1" | "run 1st and 2nd" | "run first and second" | "1-2" | "all"
 */
function parseDemoSelection(raw) {
  if (raw == null || String(raw).trim() === "") return resolveDemoSelection("1");

  const original = String(raw).trim();
  let s = original.toLowerCase();

  if (s === "all" || /\ball\s+(5|five|demo)\b/.test(s)) {
    return resolveDemoSelection("all");
  }

  s = s
    .replace(/^(please\s+)?(run|execute|start)\s+(the\s+)?/i, "")
    .replace(/^(square\s+)?(live\s+)?demo\s+(tc(s)?\s*)?/i, "")
    .replace(/^tc(s)?\s*/i, "")
    .replace(/\btest\s*cases?\s*/gi, "")
    .trim();

  const nums = new Set();

  for (const [re, n] of ORDINAL_TO_NUM) {
    if (re.test(s)) nums.add(n);
    re.lastIndex = 0;
  }

  s = s.replace(/\band\b/gi, ",").replace(/\bthrough\b/gi, "-").replace(/\bto\b/gi, "-");

  const range = s.match(/(\d)\s*-\s*(\d)/);
  if (range) {
    const lo = Math.min(Number(range[1]), Number(range[2]));
    const hi = Math.max(Number(range[1]), Number(range[2]));
    for (let i = lo; i <= hi; i++) nums.add(i);
  }

  for (const m of s.matchAll(/\b([1-5])\b/g)) {
    nums.add(Number(m[1]));
  }

  if (nums.size > 0) {
    return resolveDemoSelection([...nums].sort((a, b) => a - b).join(","));
  }

  return resolveDemoSelection(s.replace(/^demo\s+/, "") || "1");
}

/** Human-readable label for manifest / report header */
function formatDemoSelectionLabel(selected) {
  if (!selected?.length) return "—";
  if (selected.length === DEMO_TCS.length) return "All 5 demo TCs";
  return selected.map((t) => `TC ${t.num}`).join(", ");
}

function jestPatternForSelection(selected) {
  return selected.map((t) => t.key).join("|");
}

function tagsForSelection(selected) {
  const tags = [...new Set(selected.map((t) => t.tag))];
  return tags.length === 1 ? tags[0] : tags.join("|");
}

module.exports = {
  DEMO_LOG,
  DEMO_MANIFEST,
  DEMO_TCS,
  resolveDemoSelection,
  parseDemoSelection,
  formatDemoSelectionLabel,
  jestPatternForSelection,
  tagsForSelection,
};
