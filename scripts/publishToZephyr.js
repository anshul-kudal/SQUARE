#!/usr/bin/env node
/**
 * Publish Square demo test run results to Zephyr Scale Cloud.
 *
 * Creates ONE test cycle named "Square Demo — <timestamp>" in project PRE,
 * then one test execution per TC that ran, with:
 *   - statusName  : Pass / Fail (mapped from the run result)
 *   - assignedToId: your accountId (from env/zephyr.env)
 *   - comment     : test data + Square Order ID + NS Cash Sale ID as proof
 *
 * Usage:
 *   node scripts/publishToZephyr.js [logPath]
 *   (reads /tmp/square_demo_manifest.json for the selected TCs)
 *
 * Credentials: env/zephyr.env (gitignored) or process.env.
 *   ZEPHYR_API_TOKEN, ZEPHYR_BASE_URL, ZEPHYR_PROJECT_KEY,
 *   ZEPHYR_ASSIGNEE_ACCOUNT_ID
 *
 * Opt-in: only runs from the demo runner when ZEPHYR_PUBLISH=1.
 */
const fs = require("fs");
const path = require("path");
const { buildRows } = require("./generateSquareDemoReport");
const { DEMO_LOG } = require("../helpers/squareDemoConfig");

const ROOT = path.join(__dirname, "..");

function loadZephyrEnv() {
  const envPath = path.join(ROOT, "env", "zephyr.env");
  const cfg = {};
  if (fs.existsSync(envPath)) {
    for (const raw of fs.readFileSync(envPath, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      cfg[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }
  // process.env overrides file values
  for (const k of [
    "ZEPHYR_API_TOKEN",
    "ZEPHYR_BASE_URL",
    "ZEPHYR_PROJECT_KEY",
    "ZEPHYR_ASSIGNEE_ACCOUNT_ID",
    "ZEPHYR_APP_URL",
    "ZEPHYR_JIRA_PROJECT_ID",
    "ZEPHYR_FOLDER_ID",
    "ZEPHYR_FOLDER_NAME",
  ]) {
    if (process.env[k]) cfg[k] = process.env[k];
  }
  return cfg;
}

function nowStampIST() {
  // Render a human IST timestamp for the cycle name.
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} IST`;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildComment(row, envInfo) {
  const lines = [];
  lines.push(`<p><strong>Automated run</strong> — Square POS → Integrator.io → NetSuite</p>`);
  lines.push("<ul>");
  lines.push(`<li><b>Result:</b> ${esc(row.status)}</li>`);
  lines.push(`<li><b>Test key (automation):</b> ${esc(row.key)}</li>`);
  lines.push(`<li><b>Run time:</b> ${esc(row.runTime)}</li>`);
  if (row.squareOrderId)
    lines.push(`<li><b>Square Order ID:</b> ${esc(row.squareOrderId)}</li>`);
  if (row.nsOrderId)
    lines.push(`<li><b>NetSuite Cash Sale ID:</b> ${esc(row.nsOrderId)}</li>`);
  if (row.onDemandKey)
    lines.push(`<li><b>On-demand sync key:</b> ${esc(row.onDemandKey)}</li>`);
  if (row.valFields && row.valFields.eTailOrderId)
    lines.push(`<li><b>eTail Order Id:</b> ${esc(row.valFields.eTailOrderId)}</li>`);
  lines.push(`<li><b>IO environment:</b> ${esc(envInfo.ioEnvironment || "—")}</li>`);
  lines.push(`<li><b>NetSuite account:</b> ${esc(envInfo.nsAccount || "—")}</li>`);
  lines.push(`<li><b>Log file:</b> ${esc(row.logFile || "—")}</li>`);
  lines.push("</ul>");
  if (row.status === "FAIL" && row.reason) {
    lines.push(`<p><b>Failure reason:</b> ${esc(row.reason)}</p>`);
  }
  const variances = Object.entries(row.valFields?.variances || {});
  if (variances.length) {
    lines.push("<p><b>Variances:</b></p><ul>");
    for (const [k, v] of variances) lines.push(`<li>${esc(k)}: ${esc(v)}</li>`);
    lines.push("</ul>");
  }
  return lines.join("");
}

function parseVersion(name) {
  const m = String(name)
    .trim()
    .match(/^(\d{4})\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] || 0)];
}

/**
 * Resolve which TEST_CYCLE folder to drop the cycle into.
 * Priority: ZEPHYR_FOLDER_ID > ZEPHYR_FOLDER_NAME (exact match) >
 * the latest release-version folder (e.g. 2026.7.1).
 */
async function resolveFolderId(cfg) {
  if (cfg.ZEPHYR_FOLDER_ID) {
    return { id: Number(cfg.ZEPHYR_FOLDER_ID), name: `id ${cfg.ZEPHYR_FOLDER_ID}` };
  }
  const res = await zephyrFetch(
    cfg,
    "GET",
    `/folders?projectKey=${cfg.ZEPHYR_PROJECT_KEY}&folderType=TEST_CYCLE&maxResults=1000`
  );
  if (!res.ok || !Array.isArray(res.json?.values)) {
    console.warn(`[Zephyr] Could not list folders (HTTP ${res.status}); cycle goes to root.`);
    return null;
  }
  const folders = res.json.values;

  if (cfg.ZEPHYR_FOLDER_NAME) {
    const want = cfg.ZEPHYR_FOLDER_NAME.trim().toLowerCase();
    const hit = folders.find((f) => String(f.name).trim().toLowerCase() === want);
    if (hit) return { id: hit.id, name: hit.name };
    console.warn(`[Zephyr] Folder "${cfg.ZEPHYR_FOLDER_NAME}" not found; using latest version folder.`);
  }

  const versioned = folders
    .map((f) => ({ v: parseVersion(f.name), id: f.id, name: f.name }))
    .filter((f) => f.v);
  if (!versioned.length) {
    console.warn("[Zephyr] No release-version folders found; cycle goes to root.");
    return null;
  }
  versioned.sort((a, b) => {
    for (let i = 0; i < 3; i++) {
      if (a.v[i] !== b.v[i]) return a.v[i] - b.v[i];
    }
    return a.id - b.id; // tiebreak: newer folder (higher id) wins
  });
  const latest = versioned[versioned.length - 1];
  return { id: latest.id, name: latest.name };
}

async function zephyrFetch(cfg, method, endpoint, body) {
  const base = cfg.ZEPHYR_BASE_URL.replace(/\/+$/, "");
  const res = await fetch(`${base}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.ZEPHYR_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-json */
  }
  return { status: res.status, ok: res.ok, json, text };
}

async function main() {
  const logPath = process.argv[2] || DEMO_LOG;
  const cfg = loadZephyrEnv();

  if (!cfg.ZEPHYR_API_TOKEN || !cfg.ZEPHYR_BASE_URL || !cfg.ZEPHYR_PROJECT_KEY) {
    console.warn(
      "[Zephyr] Missing credentials (ZEPHYR_API_TOKEN / ZEPHYR_BASE_URL / ZEPHYR_PROJECT_KEY). Skipping publish."
    );
    process.exit(0);
  }

  if (!fs.existsSync(logPath)) {
    console.warn(`[Zephyr] Log file not found: ${logPath}. Skipping publish.`);
    process.exit(0);
  }

  const { rows, manifest, envInfo } = buildRows(logPath);
  const executed = rows.filter((r) => r.status === "PASS" || r.status === "FAIL");

  if (!executed.length) {
    console.warn("[Zephyr] No executed TCs (PASS/FAIL) found in log. Skipping publish.");
    process.exit(0);
  }

  const projectKey = cfg.ZEPHYR_PROJECT_KEY;
  const selectionLabel = manifest.selection || manifest.selectionRaw || "Square demo";
  const cycleName = `Square Demo — ${nowStampIST()}`;
  const passed = executed.filter((r) => r.status === "PASS").length;
  const failed = executed.filter((r) => r.status === "FAIL").length;

  const folder = await resolveFolderId(cfg);
  if (folder) console.log(`[Zephyr] Target folder: ${folder.name} (id ${folder.id})`);

  console.log(`[Zephyr] Creating test cycle: "${cycleName}" (project ${projectKey})`);
  const cyclePayload = {
    projectKey,
    name: cycleName,
    description:
      `Automated Square → NetSuite demo run (${esc(selectionLabel)}). ` +
      `Passed: ${passed}, Failed: ${failed}. Log: ${path.basename(logPath)}`,
  };
  if (folder) cyclePayload.folderId = folder.id;
  const cycleRes = await zephyrFetch(cfg, "POST", "/testcycles", cyclePayload);

  if (!cycleRes.ok || !cycleRes.json?.key) {
    console.error(
      `[Zephyr] Failed to create test cycle (HTTP ${cycleRes.status}): ${cycleRes.text}`
    );
    process.exit(1);
  }

  const cycleKey = cycleRes.json.key;
  console.log(`[Zephyr] Test cycle created: ${cycleKey}`);

  const assignee = cfg.ZEPHYR_ASSIGNEE_ACCOUNT_ID || undefined;
  const results = [];

  for (const row of executed) {
    const payload = {
      projectKey,
      testCaseKey: row.tcId,
      testCycleKey: cycleKey,
      statusName: row.status === "PASS" ? "Pass" : "Fail",
      comment: buildComment(row, envInfo),
    };
    if (row.durationSec != null) payload.executionTime = Math.round(row.durationSec * 1000);
    if (assignee) {
      payload.assignedToId = assignee;
      payload.executedById = assignee;
    }

    const execRes = await zephyrFetch(cfg, "POST", "/testexecutions", payload);
    if (execRes.ok) {
      console.log(
        `[Zephyr]   ✓ ${row.tcId} → ${payload.statusName}` +
          (row.squareOrderId ? ` (Square ${row.squareOrderId}, NS ${row.nsOrderId || "—"})` : "")
      );
      results.push({ tc: row.tcId, status: payload.statusName, ok: true });
    } else {
      console.error(
        `[Zephyr]   ✗ ${row.tcId} failed (HTTP ${execRes.status}): ${execRes.text}`
      );
      results.push({ tc: row.tcId, status: payload.statusName, ok: false, error: execRes.text });
    }
  }

  // Deep link to the Zephyr Scale app inside Jira. The app path is
  // instance-specific; ZEPHYR_APP_URL can override. Default = celigo PRE.
  const appUrl =
    cfg.ZEPHYR_APP_URL ||
    "https://celigo.atlassian.net/jira/software/projects/PRE/apps/3feb7ced-1450-4676-aded-099c99bf534b/2baaeb69-15ac-4955-8eb6-e346aa1567aa";
  const jiraProjectId = cfg.ZEPHYR_JIRA_PROJECT_ID || "14586";
  const cycleLink = `${appUrl}#/v2/testCycle/${cycleKey}?projectId=${jiraProjectId}`;

  console.log("");
  console.log("==============================================");
  console.log(` Zephyr cycle: ${cycleKey}`);
  console.log(`   ${cycleName}`);
  if (folder) console.log(`   Folder: ${folder.name}`);
  console.log(`   Executions: ${results.filter((r) => r.ok).length}/${results.length} published`);
  console.log(`   Open in Jira: ${cycleLink}`);
  console.log(`   (or: Zephyr Scale → Test Cycles tab → search "${cycleKey}")`);
  console.log("==============================================");

  const anyFailed = results.some((r) => !r.ok);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error(`[Zephyr] Publish error: ${err?.message || err}`);
  process.exit(1);
});
