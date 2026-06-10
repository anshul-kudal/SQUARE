#!/usr/bin/env node
/**
 * Generate a self-contained HTML report for Square Order Import suites.
 *
 * Usage:
 *   node scripts/generateSquareHtmlReport.js [log1.log log2.log ...]
 *
 * If no logs given, uses /tmp/square_batches1-5.log when present.
 * Inventory is loaded from testcases/Square_Suite/Order_Import/*.json
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TC_DIR = path.join(ROOT, "testcases/Square_Suite/Order_Import");
const TC_ROOT = path.join(ROOT, "testcases/Square_Suite");
const LOG_DIR = path.join(ROOT, "logs");
const SQUARE_REPO_URL = "https://github.com/anshul-kudal/SQUARE";
const OUT_DIR = path.join(ROOT, "report");
const ENV_FILE = path.join(ROOT, "env/E2E_Square.env");

function discoverLogPaths() {
  if (!fs.existsSync(LOG_DIR)) return [];
  return fs
    .readdirSync(LOG_DIR)
    .filter((f) => f.startsWith("test-run-dev-Square_Suite") && f.endsWith(".log"))
    .map((f) => path.join(LOG_DIR, f));
}

function loadEnvInfo() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const lines = fs.readFileSync(ENV_FILE, "utf8").split("\n");
  const env = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_.]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return {
    nsAccount: env["CONNECTIONS.NS_ACCOUNT_IDENTIFIER"] || "—",
    nsConnectionId: env["CONNECTIONS.NETSUITE"] || "—",
    ioEnvironment: env.ENVIRONMENT || env.ENV || "—",
    ioBaseUrl: env.BASE_URL || "—",
    integration: env["CONNECTIONS.IO_CONNECTOR_IDENTIFIER"] || "—",
    integrationId: env["CONNECTIONS.SQUARE_INTEGRATION_ID"] || env["CONNECTIONS.SQUARE_NS_INTEGRATION"] || "—",
    squareStore: env["SQUARE_PRIMARY_STORE_DATA.STORE_NAME"] || "—",
    squareLocation: env["SQUARE_PRIMARY_STORE_DATA.LOCATION_ID"] || "—",
    defaultCustomerId: env["DEFAULT_CUSTOMER.ID"] || "—",
    nsLocationId: env["NS_LOCATION_ID.ID"] || "—",
  };
}

function extractKeyPrefixes(ix) {
  const prefixes = new Set();
  for (const step of ix.pre_request || []) {
    if (step.request?.orderKeyPrefix) prefixes.add(step.request.orderKeyPrefix);
    const payload = step.request?.payload;
    if (typeof payload === "string") {
      const m = payload.match(/\/(PRET\d+|PRE25603SC\d+|PRE25603\w+)\//);
      if (m) prefixes.add(m[1]);
    }
    for (const k of Object.keys(step.request || {})) {
      const m = k.match(/^store_(PRET\d+|PRE25603SC\d+|PRE25603\w+)/);
      if (m) prefixes.add(m[1]);
    }
  }
  if (ix.response?.uniqueValue) {
    const m = String(ix.response.uniqueValue).match(
      /\{\{(PRET\d+|PRE25603SC\d+|PRE25603\w+)squareOrderId\}\}/
    );
    if (m) prefixes.add(m[1]);
  }
  return [...prefixes];
}

function keyBelongsToPrefixes(mapKey, prefixes) {
  if (!mapKey.endsWith("squareOrderId")) return false;
  const p = mapKey.replace(/squareOrderId$/, "");
  return prefixes.some(
    (pref) => p === pref || (p.startsWith(pref) && /^T\d+$/.test(p.slice(pref.length)))
  );
}

function extractOrderIdsFromMap(mapObj, keyPrefixes) {
  if (!mapObj || !keyPrefixes?.length) {
    return { squareOrderIds: [], squareOrderId: null, cashSaleId: null };
  }

  const squareOrderIds = [];
  for (const [k, v] of Object.entries(mapObj)) {
    if (keyBelongsToPrefixes(k, keyPrefixes) && v && typeof v === "string") {
      if (!squareOrderIds.includes(v)) squareOrderIds.push(v);
    }
  }

  for (const pref of keyPrefixes) {
    const odKey = `${pref}onDemandOrderSync`;
    const odVal = mapObj[odKey];
    if (typeof odVal === "string") {
      if (odVal.includes(",")) {
        for (const part of odVal.split(",")) {
          const id = part.split("-").slice(1).join("-");
          if (id && !squareOrderIds.includes(id)) squareOrderIds.push(id);
        }
      } else if (odVal.includes("-")) {
        const id = odVal.split("-").slice(1).join("-");
        if (id && !squareOrderIds.includes(id)) squareOrderIds.push(id);
      }
    }
  }

  let cashSaleId = null;
  for (const pref of keyPrefixes) {
    const direct = mapObj[`${pref}cashSaleId`];
    if (direct) {
      cashSaleId = String(direct);
      break;
    }
  }
  if (!cashSaleId) {
    for (const pref of keyPrefixes) {
      for (const [k, v] of Object.entries(mapObj)) {
        if (k.endsWith("cashSaleId") && k.includes(pref) && v) {
          cashSaleId = String(v);
        }
      }
    }
  }

  return {
    squareOrderIds,
    squareOrderId: squareOrderIds[0] || null,
    cashSaleId,
  };
}

function stripAnsi(s) {
  return s.replace(/\u001b\[[0-9;]*m/g, "");
}

/** Structured JSON log lines wrap the text in "message" — unwrap before regex parsing. */
function logMessage(rawLine) {
  const trimmed = stripAnsi(rawLine).trim();
  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed);
      if (typeof j.message === "string") return j.message;
    } catch {
      /* plain text line */
    }
  }
  return trimmed;
}

function parseTitleMeta(testTitle) {
  const batch = (testTitle.match(/\[Batch(\d+)\]/i) || [])[1] || "?";
  const zephyr =
    (testTitle.match(/\[(PRE-T[^\]]+|PRE-25603[^\]]*|PRE25603[^\]]*)\]/i) || [])[1] || "—";
  const descMatch = testTitle.match(/\]\s*-\s*(.+?)(?:\s+with\s+\/|$)/);
  const description = descMatch
    ? descMatch[1].trim()
    : testTitle.split(" - ").slice(1).join(" - ").split(" with ")[0].trim();
  const testKey = (testTitle.match(/^(Batch\d+\w+)/) || [])[1] || testTitle.split(" ")[0];
  return { batch, zephyr, description, testKey, testTitle };
}

function loadInventory() {
  const items = [];
  const seen = new Set();
  const scanDirs = [TC_DIR, TC_ROOT].filter((d) => fs.existsSync(d));
  for (const dir of scanDirs) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    for (const file of files) {
      if (seen.has(file)) continue;
      seen.add(file);
      const json = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      const batchNum =
        (file.match(/Batch(\d+)/i) || [])[1] ||
        (file.includes("25603") ? "SC1" : "?");
    for (const suite of json.testData || []) {
      for (const ix of suite.interactions || []) {
        const title = ix.test_title || ix.test || "";
        const meta = parseTitleMeta(title);
        items.push({
          ...meta,
          batch: meta.batch !== "?" ? meta.batch : batchNum,
          suite: suite.suite_title || suite.suite || file,
          test: ix.test || meta.testKey,
          sourceFile: file,
          keyPrefixes: extractKeyPrefixes(ix),
          skipNsValidation:
            ix.request?.method === "GET" &&
            String(ix.request?.path || "").includes("integrationID"),
        });
      }
    }
    }
  }
  return items;
}

function parseLogFile(logPath) {
  if (!fs.existsSync(logPath)) return { results: new Map(), suiteSec: null, summary: null, logPath };
  const text = stripAnsi(fs.readFileSync(logPath, "utf8"));
  const results = new Map();

  // Per-TC timing from "Test completed in X.Xs" (most reliable)
  let currentTitle = null;
  let lastMapTitle = null;
  for (const rawLine of text.split("\n")) {
    const line = logMessage(rawLine);
    if (!line) continue;

    const runM = line.match(/Running Test Case\s*:\s*(.+?)(?:\s+\(attempt|\s*$)/);
    if (runM) currentTitle = runM[1].trim();

    const doneM = line.match(/Test completed in ([\d.]+)s/);
    if (doneM && currentTitle) {
      const sec = parseFloat(doneM[1]);
      const prev = results.get(currentTitle) || {};
      results.set(currentTitle, {
        ...prev,
        testTitle: currentTitle,
        durationSec: sec,
        durationMs: Math.round(sec * 1000),
        status: prev.status === "FAIL" ? "FAIL" : "PASS",
        logFile: path.basename(logPath),
      });
      currentTitle = null;
    }

    const retryFail = line.match(/\[RETRY\]\s+"(.+?)"\s+attempt\s+\d+\s+failed\s+—\s+\[([^\]]+)\]\s+(.+)/);
    if (retryFail) {
      const title = retryFail[1].trim();
      const prev = results.get(title) || { testTitle: title };
      if (prev.status !== "PASS") {
        results.set(title, {
          ...prev,
          status: "FAIL",
          category: retryFail[2],
          reason: retryFail[3].trim().slice(0, 500),
          logFile: path.basename(logPath),
        });
      }
    }

    const mapM = line.match(/MAP\s+>>\s+(\{.+)$/);
    if (mapM) {
      try {
        const mapObj = JSON.parse(mapM[1]);
        const title = mapObj.test_title || currentTitle;
        if (title) {
          lastMapTitle = title;
          const prev = results.get(title) || { testTitle: title };
          results.set(title, {
            ...prev,
            mapRaw: mapObj,
            logFile: path.basename(logPath),
          });
        }
      } catch {
        /* ignore malformed map json */
      }
    }

    const csM = line.match(/cashSaleId stored:\s*(\d+)/);
    const csTitle = lastMapTitle || currentTitle;
    if (csM && csTitle) {
      const prev = results.get(csTitle) || { testTitle: csTitle };
      results.set(csTitle, {
        ...prev,
        cashSaleId: csM[1],
        logFile: path.basename(logPath),
      });
    }
  }

  // Jest pass/fail lines
  for (const m of text.matchAll(/^\s*([✓✕])\s+(.+?)\s+\((\d+)\s+ms\)/gm)) {
    const title = m[2].trim();
    const ms = Number(m[3]);
    const status = m[1] === "✓" ? "PASS" : "FAIL";
    const prev = results.get(title) || { testTitle: title };
    results.set(title, {
      ...prev,
      status: status === "FAIL" ? "FAIL" : prev.status === "FAIL" ? "FAIL" : "PASS",
      durationMs: prev.durationMs || ms,
      durationSec: prev.durationSec || ms / 1000,
      logFile: path.basename(logPath),
    });
  }

  // Jest failure blocks
  const failBlocks = text.split(/\n\s*●\s+/);
  for (const block of failBlocks.slice(1)) {
    const lines = block.split("\n");
    const header = lines[0].trim();
    const titleLine = lines.find((l) => l.includes("Batch") && l.includes("›"));
    if (!titleLine) continue;
    const titlePart = titleLine.split("›").pop().trim().split(" with ")[0].trim();
    const fullTitle = titlePart.includes("Batch") ? titlePart : null;
    if (!fullTitle) continue;

    const reasonLines = [];
    for (const l of lines) {
      if (/Received Response Status Code:\s*409/.test(l)) {
        reasonLines.push("409 job_already_queued — flow still running from prior test");
      } else if (/Exceeded timeout of (\d+) ms/.test(l)) {
        const tm = l.match(/Exceeded timeout of (\d+) ms/);
        reasonLines.push(`Jest timeout after ${tm ? (Number(tm[1]) / 1000).toFixed(0) : "?"}s`);
      } else if (/expect\(received\)\.toBe\(expected\)/.test(l)) {
        reasonLines.push("Validation failed (status/body mismatch)");
      } else if (/Error:/.test(l) && !/at Object/.test(l)) {
        reasonLines.push(l.replace(/^\s*/, "").slice(0, 200));
      } else if (/job_already_queued/.test(l)) {
        reasonLines.push("409 job_already_queued");
      } else if (/No NetSuite data found/.test(l)) {
        reasonLines.push("No NetSuite data found after retries");
      }
    }
    const reason = [...new Set(reasonLines)].join("; ") || header.slice(0, 200);
    const prev = results.get(fullTitle) || { testTitle: fullTitle };
    results.set(fullTitle, {
      ...prev,
      status: "FAIL",
      reason,
      logFile: path.basename(logPath),
    });
  }

  // FAILED TESTS summary section
  const failSection = text.split("FAILED TESTS:")[1];
  if (failSection) {
    const chunk = failSection.split("SLOW TESTS")[0] || failSection;
    for (const m of chunk.matchAll(/[✗✕]\s+(.+?)(?:\n\s*→\s*(.+))?/g)) {
      const title = m[1].trim();
      const reason = m[2] ? m[2].trim() : null;
      const prev = results.get(title) || { testTitle: title };
      results.set(title, {
        ...prev,
        status: "FAIL",
        reason: reason || prev.reason || "See log",
        logFile: path.basename(logPath),
      });
    }
  }

  const suiteTimeMatch = text.match(/Time:\s+([\d.]+)\s+s/);
  const summaryMatch = text.match(
    /Total:\s+(\d+)[\s\S]*?Passed:\s+(\d+)[\s\S]*?Failed:\s+(\d+)(?:[\s\S]*?Skipped:\s+(\d+))?/
  );
  const jestSummary = text.match(/Tests:\s+(\d+) failed, (\d+) passed, (\d+) total/);

  return {
    results,
    suiteSec: suiteTimeMatch ? Number(suiteTimeMatch[1]) : null,
    summary: jestSummary
      ? {
          total: Number(jestSummary[3]),
          passed: Number(jestSummary[2]),
          failed: Number(jestSummary[1]),
          skipped: 0,
        }
      : summaryMatch
        ? {
            total: Number(summaryMatch[1]),
            passed: Number(summaryMatch[2]),
            failed: Number(summaryMatch[3]),
            skipped: Number(summaryMatch[4] || 0),
          }
        : null,
    logPath,
  };
}

function matchResult(inventoryItem, resultsMap) {
  if (resultsMap.has(inventoryItem.testTitle)) {
    return resultsMap.get(inventoryItem.testTitle);
  }
  for (const [k, v] of resultsMap) {
    const kBase = k.split(" with ")[0].trim();
    const itemBase = inventoryItem.testTitle.split(" with ")[0].trim();
    if (kBase === itemBase) return v;
    if (k.includes(inventoryItem.test) && k.includes(`[Batch${inventoryItem.batch}]`)) return v;
  }
  return null;
}

function fmtDuration(sec) {
  if (sec == null || Number.isNaN(sec)) return "—";
  if (sec >= 3600) return `${(sec / 3600).toFixed(2)}h`;
  if (sec >= 60) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
  return `${sec.toFixed(1)}s`;
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatOrderIds(r) {
  if (!r.squareOrderIds?.length && !r.squareOrderId) return "—";
  const ids = r.squareOrderIds?.length ? r.squareOrderIds : [r.squareOrderId];
  if (ids.length === 1) return ids[0];
  return ids.join(", ");
}

function buildHtml({ inventory, rows, logs, generatedAt, envInfo, suiteSec, jestSummary }) {
  const passedRows = rows.filter((r) => r.status === "PASS");
  const failRows = rows.filter((r) => r.status === "FAIL");
  const notRunRows = rows.filter((r) => r.status === "NOT_RUN");
  const total = inventory.length;
  const mergedLogs = (logs?.length ?? 0) > 1;
  const jestLooksFullSuite = jestSummary && jestSummary.total >= 100;
  const useRowCounts = mergedLogs || !jestLooksFullSuite;
  const passed = useRowCounts ? passedRows.length : jestSummary.passed;
  const failed = useRowCounts ? failRows.length : jestSummary.failed;
  const summedSec = rows
    .filter((r) => r.status === "PASS" || r.status === "FAIL")
    .reduce((s, r) => s + (r.durationSec || 0), 0);
  const totalExecSec = mergedLogs ? summedSec : suiteSec ?? summedSec;
  const passRate = total ? Math.round((passed / total) * 100) : 0;
  const uniqueZephyr = new Set(
    inventory.map((i) => i.zephyr).filter((z) => z.startsWith("PRE-T"))
  ).size;
  const automated = total;
  const remainingAutomate = 0;
  const remainingStabilize = failed;
  const automatePct = 100;
  const stability =
    total === 0
      ? "NO-DATA"
      : failed === 0 && passed === total
        ? "STABLE"
        : passRate >= 70
          ? "PARTIAL"
          : "UNSTABLE";

  const batchStats = {};
  for (const r of rows) {
    const b = r.batch;
    if (!batchStats[b]) batchStats[b] = { planned: 0, pass: 0, fail: 0, notRun: 0, time: 0 };
    batchStats[b].planned++;
    if (r.status === "PASS") {
      batchStats[b].pass++;
      batchStats[b].time += r.durationSec || 0;
    } else if (r.status === "FAIL") batchStats[b].fail++;
    else batchStats[b].notRun++;
  }

  const allRows = rows;

  const tableRows = allRows
    .map((r, i) => {
      const statusClass =
        r.status === "PASS" ? "pass" : r.status === "FAIL" ? "fail" : "pending";
      const orderDisplay = formatOrderIds(r);
      const orderTitle = r.squareOrderIds?.length > 1 ? r.squareOrderIds.join("\n") : orderDisplay;
      const csDisplay = r.skipNsValidation && !r.cashSaleId
        ? `<span class="muted" title="Negative TC — validates IO only, no NS cash sale lookup">N/A</span>`
        : r.cashSaleId
          ? esc(r.cashSaleId)
          : "—";
      return `<tr class="row-${statusClass}" data-batch="${esc(r.batch)}" data-status="${esc(r.status)}">
        <td>${i + 1}</td>
        <td><span class="badge batch">B${esc(r.batch)}</span></td>
        <td><code>${esc(r.zephyr)}</code></td>
        <td><strong>${esc(r.test)}</strong></td>
        <td>${esc(r.description)}</td>
        <td class="mono" title="${esc(orderTitle)}">${esc(orderDisplay)}</td>
        <td class="mono">${csDisplay}</td>
        <td><span class="badge ${statusClass}">${esc(r.status)}</span></td>
        <td class="num">${esc(fmtDuration(r.durationSec))}</td>
        <td class="reason">${r.reason ? esc(r.reason) : "—"}</td>
      </tr>`;
    })
    .join("\n");

  const batchCards = Object.keys(batchStats)
    .sort((a, b) => {
      if (a === "SC1") return 1;
      if (b === "SC1") return -1;
      return Number(a) - Number(b);
    })
    .map((b) => {
      const s = batchStats[b];
      const pct = s.planned ? Math.round((s.pass / s.planned) * 100) : 0;
      const label = b === "SC1" ? "SC1" : `Batch ${b}`;
      return `<div class="batch-card">
        <h3>${label}</h3>
        <div class="batch-metrics">
          <span class="pass">${s.pass} pass</span>
          <span class="fail">${s.fail} fail</span>
          <span class="muted">${s.planned} TCs</span>
        </div>
        <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
        <div class="muted">${pct}% · ${fmtDuration(s.time)}</div>
      </div>`;
    })
    .join("\n");

  const failDetails = failRows.length
    ? failRows
        .map(
          (r) => `<div class="fail-card">
        <h4><code>${esc(r.zephyr)}</code> — ${esc(r.description)}</h4>
        <p class="muted">${esc(r.testTitle)}</p>
        <p><strong>Square Order ID:</strong> <code>${esc(formatOrderIds(r))}</code>
        ${r.cashSaleId ? ` · <strong>NS Cash Sale ID:</strong> <code>${esc(r.cashSaleId)}</code>` : ""}</p>
        <pre>${esc(r.reason || "No error captured in log")}</pre>
      </div>`
        )
        .join("\n")
    : `<p class="empty">No failures in this run.</p>`;

  const envBanner = envInfo
    ? `<div class="env-banner">
        <div><span class="env-label">NetSuite Account</span><strong>${esc(envInfo.nsAccount)}</strong></div>
        <div><span class="env-label">NS Connection</span><code>${esc(envInfo.nsConnectionId)}</code></div>
        <div><span class="env-label">NS Location ID</span><code>${esc(envInfo.nsLocationId)}</code></div>
        <div><span class="env-label">Default NS Customer</span><code>${esc(envInfo.defaultCustomerId)}</code></div>
        <div><span class="env-label">IO Environment</span>${esc(envInfo.ioEnvironment)} · ${esc(envInfo.ioBaseUrl)}</div>
        <div><span class="env-label">Integration</span>${esc(envInfo.integration)}</div>
        <div><span class="env-label">Square Store / Location</span>${esc(envInfo.squareStore)} · <code>${esc(envInfo.squareLocation)}</code></div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Square Order Import — Test Report</title>
  <style>
    :root {
      --bg: #0f1419;
      --surface: #1a2332;
      --surface2: #243044;
      --text: #e7ecf3;
      --muted: #8b9cb3;
      --pass: #3dd68c;
      --fail: #f87171;
      --pending: #fbbf24;
      --accent: #60a5fa;
      --border: #2d3a4f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    header {
      background: linear-gradient(135deg, #1e3a5f 0%, #0f1419 100%);
      padding: 2rem 2rem 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    header h1 { margin: 0 0 0.25rem; font-size: 1.75rem; }
    header p { margin: 0; color: var(--muted); }
    main { padding: 1.5rem 2rem 3rem; max-width: 1600px; margin: 0 auto; }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem 1.25rem;
    }
    .card .label { font-size: 0.8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .card .value { font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem; }
    .card.pass .value { color: var(--pass); }
    .card.fail .value { color: var(--fail); }
    .card.pending .value { color: var(--pending); }
    .card.time .value { color: var(--accent); font-size: 1.35rem; }
    .stability {
      display: inline-block;
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: 1rem;
    }
    .stability.STABLE { background: rgba(61,214,140,0.15); color: var(--pass); }
    .stability.UNSTABLE { background: rgba(248,113,113,0.15); color: var(--fail); }
    .stability.PARTIAL { background: rgba(251,191,36,0.15); color: var(--pending); }
    .stability.NO-DATA { background: rgba(139,156,179,0.15); color: var(--muted); }
    .env-banner {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 0.75rem 1.25rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      margin-top: 1rem;
      font-size: 0.88rem;
    }
    .env-label {
      display: block;
      font-size: 0.72rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 0.15rem;
    }
    td.mono, .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; word-break: break-all; max-width: 180px; }
    h2 { font-size: 1.25rem; margin: 2rem 0 1rem; }
    .batch-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .batch-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem;
    }
    .batch-card h3 { margin: 0 0 0.5rem; font-size: 1rem; }
    .batch-metrics { display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.85rem; margin-bottom: 0.5rem; }
    .batch-metrics .pass { color: var(--pass); }
    .batch-metrics .fail { color: var(--fail); }
    .batch-metrics .pending { color: var(--pending); }
    .progress { height: 6px; background: var(--surface2); border-radius: 3px; overflow: hidden; margin: 0.5rem 0; }
    .progress .bar { height: 100%; background: var(--pass); border-radius: 3px; }
    .toolbar {
      display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-bottom: 1rem;
    }
    .toolbar input, .toolbar select {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      font-size: 0.9rem;
    }
    .toolbar input { min-width: 220px; flex: 1; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      font-size: 0.88rem;
    }
    th, td { padding: 0.65rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
    th { background: var(--surface2); color: var(--muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; position: sticky; top: 0; }
    tr:hover { background: rgba(96,165,250,0.06); }
    tr.row-pass { border-left: 3px solid var(--pass); }
    tr.row-fail { border-left: 3px solid var(--fail); }
    tr.row-pending { border-left: 3px solid var(--pending); }
    td.num { white-space: nowrap; font-variant-numeric: tabular-nums; }
    td.reason { max-width: 280px; font-size: 0.82rem; color: var(--fail); word-break: break-word; }
    .muted { color: var(--muted); font-size: 0.82rem; }
    .badge {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge.pass { background: rgba(61,214,140,0.15); color: var(--pass); }
    .badge.fail { background: rgba(248,113,113,0.15); color: var(--fail); }
    .badge.pending, .badge.NOT_RUN { background: rgba(251,191,36,0.12); color: var(--pending); }
    .badge.batch { background: rgba(96,165,250,0.12); color: var(--accent); }
    code { font-family: ui-monospace, monospace; font-size: 0.85em; }
    .fail-card {
      background: var(--surface);
      border: 1px solid rgba(248,113,113,0.3);
      border-radius: 10px;
      padding: 1rem 1.25rem;
      margin-bottom: 1rem;
    }
    .fail-card h4 { margin: 0 0 0.35rem; }
    .fail-card pre {
      background: #0a0e14;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.82rem;
      color: #fca5a5;
      margin: 0.5rem 0 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .empty { color: var(--muted); }
    .scope-list { color: var(--muted); font-size: 0.9rem; line-height: 1.6; }
    .scope-list li { margin-bottom: 0.5rem; }
    .table-wrap { overflow-x: auto; border-radius: 12px; }
    footer { text-align: center; padding: 2rem; color: var(--muted); font-size: 0.85rem; }
    .nav-links a { color: var(--accent); margin-right: 1rem; text-decoration: none; font-size: 0.9rem; }
    .hero { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem 2rem; margin-bottom: 2rem; }
    .hero h2 { margin-top: 0; border: none; font-size: 1.35rem; }
    .hero-lead { color: var(--muted); max-width: 900px; }
    .hero-cards .card.highlight { border-color: var(--accent); }
    .callout-box { background: rgba(96,165,250,0.1); border: 1px solid var(--accent); border-radius: 10px; padding: 1rem 1.25rem; margin-top: 1rem; font-size: 0.95rem; }
    .callout-box a { color: var(--accent); }
    .row-fail { opacity: 0.95; }
    .row-pending td { color: var(--muted); }
    .badge.pending { background: rgba(251,191,36,0.2); color: var(--pending); }
    .tile-row { margin: 1.25rem 0 0; }
    .tile-row-title { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 0.75rem; font-weight: 600; }
    .progress-wrap { margin: 1rem 0; }
    .progress-label { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--muted); margin-bottom: 0.35rem; }
    .progress-bar { height: 10px; background: var(--surface2); border-radius: 6px; overflow: hidden; border: 1px solid var(--border); }
    .progress-fill { height: 100%; border-radius: 6px; }
    .progress-fill.automate { background: linear-gradient(90deg, var(--accent), #7dd3fc); }
    .progress-fill.pass { background: linear-gradient(90deg, var(--pass), #6ee7b7); }
    .next-steps-box { background: rgba(96,165,250,0.08); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.25rem; margin-top: 1rem; }
    .next-steps-box h3 { margin: 0 0 0.5rem; font-size: 0.95rem; color: var(--accent); }
    .next-steps-box ol { margin: 0; padding-left: 1.25rem; color: var(--muted); font-size: 0.9rem; }
    .next-steps-box li { margin-bottom: 0.35rem; }
    .card.warn .value { color: var(--pending); }
  </style>
</head>
<body>
  <header>
    <h1>Square Order Import — Full Suite Test Report</h1>
    <p>Generated ${esc(generatedAt)} · ${total} automated TCs · Batches 1–9 + SC1 · Standalone repo: <a href="${SQUARE_REPO_URL}" style="color:#93c5fd">${SQUARE_REPO_URL}</a></p>
    <p class="nav-links">
      <a href="square-demo-guide.html">Demo Guide</a>
      <a href="square-automation-guide.html">Team Guide</a>
      <a href="square_run_history_dashboard.html">Run History</a>
      <a href="index.html">Jest Report</a>
    </p>
    <p class="muted">Logs: ${logs.map((l) => esc(path.basename(l))).join(", ") || "none"}</p>
    ${envBanner}
    <span class="stability ${stability}">${stability.replace(/-/g, " ")} · ${passRate}% pass rate</span>
  </header>
  <main>
    <section class="hero">
      <h2>Executive Summary — Square E2E Automation Achievement</h2>
      <p class="hero-lead">End-to-end REST API automation for Square POS → Integrator.io → NetSuite Cash Sale. Every test creates a real Square order, runs the IO flow, and validates NetSuite data — ready for regression on every release.</p>

      <div class="tile-row">
        <p class="tile-row-title">Latest full-suite run</p>
        <div class="cards hero-cards">
          <div class="card pass highlight"><div class="label">Passed</div><div class="value">${passed}</div></div>
          <div class="card fail highlight"><div class="label">Failed</div><div class="value">${failed}</div></div>
          <div class="card time highlight"><div class="label">Pass Rate</div><div class="value">${passRate}%</div></div>
          <div class="card time highlight"><div class="label">Full Suite Duration</div><div class="value">${esc(fmtDuration(totalExecSec))}</div></div>
          <div class="card highlight"><div class="label">Coverage</div><div class="value" style="font-size:1.1rem">B1–B9 + SC1</div></div>
        </div>
      </div>

      <div class="tile-row">
        <p class="tile-row-title">Automation coverage — total · unique · completed · remaining</p>
        <div class="cards hero-cards">
          <div class="card highlight"><div class="label">Total TCs</div><div class="value">${total}</div></div>
          <div class="card highlight"><div class="label">Unique Zephyr IDs</div><div class="value">${uniqueZephyr}</div></div>
          <div class="card pass highlight"><div class="label">Picked &amp; automated</div><div class="value">${automated}</div></div>
          <div class="card warn highlight"><div class="label">Remaining (automate)</div><div class="value">${remainingAutomate}</div></div>
          <div class="card warn highlight"><div class="label">Remaining (stabilize)</div><div class="value">${remainingStabilize}</div></div>
          <div class="card pending highlight"><div class="label">Not run (last log)</div><div class="value">${notRunRows.length}</div></div>
        </div>
        <div class="progress-wrap">
          <div class="progress-label"><span>Automation complete</span><span>${automated}/${total} (${automatePct}%)</span></div>
          <div class="progress-bar"><div class="progress-fill automate" style="width:${automatePct}%"></div></div>
        </div>
        <div class="progress-wrap">
          <div class="progress-label"><span>Latest full-suite pass rate</span><span>${passed}/${total} (${passRate}%)</span></div>
          <div class="progress-bar"><div class="progress-fill pass" style="width:${passRate}%"></div></div>
        </div>
      </div>

      <div class="next-steps-box">
        <h3>Next steps</h3>
        <ol>
          <li>All ${total} TCs automated on disk — focus on stabilizing ${remainingStabilize} full-suite failures</li>
          <li>Live demo: 3 sample TCs in ~5 min — see <a href="square-demo-guide.html">square-demo-guide.html</a></li>
          <li>Per-batch regression before hotfixes (TAG=batchN, ~15–45 min)</li>
          <li>Full suite before major releases (~8 h) · Repo: <a href="${SQUARE_REPO_URL}">${SQUARE_REPO_URL}</a></li>
        </ol>
      </div>

      <div class="callout-box">
        <strong>GitHub repo:</strong> <a href="${SQUARE_REPO_URL}">${SQUARE_REPO_URL}</a> — clone, configure <code>env/E2E_Square.env</code>, run any batch or <code>npm run square:full</code>.
      </div>
    </section>

    <h2>What We Validate</h2>
    <ul class="scope-list">
      <li><strong>Square → IO:</strong> Real orders via Square Orders API (tax, discounts, tips, modifiers, multi-line, gift cards, lot/serial items)</li>
      <li><strong>Integrator.io:</strong> Flow run, job completion, integration settings per TC (payment mapping, SKU paths, on-demand sync, customer defaults)</li>
      <li><strong>NetSuite:</strong> <code>verifyCashsaleDataFromNetsuite</code> — line items (SKU, qty, rate), discounts, tax/shipping variances (= 0), eTail order linkage</li>
    </ul>

    <div class="cards">
      <div class="card"><div class="label">In Inventory</div><div class="value">${total}</div></div>
      <div class="card pass"><div class="label">Passed</div><div class="value">${passed}</div></div>
      <div class="card fail"><div class="label">Failed</div><div class="value">${failed}</div></div>
      <div class="card pending"><div class="label">Not Run</div><div class="value">${notRunRows.length}</div></div>
      <div class="card time"><div class="label">Total Run Time</div><div class="value">${esc(fmtDuration(totalExecSec))}</div></div>
    </div>

    <h2>Batch Overview (all ${total} TCs)</h2>
    <div class="batch-grid">${batchCards || '<p class="empty">No batch data.</p>'}</div>

    <h2>All Test Cases (${total})</h2>
    <div class="toolbar">
      <input type="search" id="search" placeholder="Search TC ID, order ID, description…"/>
      <select id="filterBatch"><option value="">All batches</option>${Object.keys(batchStats).sort((a,b)=>Number(a)-Number(b)).map(b=>`<option value="${b}">Batch ${b}</option>`).join("")}</select>
    </div>
    <div class="table-wrap">
      <table id="results">
        <thead>
          <tr>
            <th>#</th><th>Batch</th><th>TC ID</th><th>Test Key</th><th>Description</th>
            <th>Square Order ID</th><th>NS Cash Sale ID</th>
            <th>Status</th><th>Duration</th><th>Failure Reason</th>
          </tr>
        </thead>
        <tbody>${tableRows || '<tr><td colspan="10" class="muted">No test results in logs.</td></tr>'}</tbody>
      </table>
    </div>

    <h2>Failure Details (${failRows.length})</h2>
    ${failDetails}

    <h2>Validation &amp; Settings (automation scope)</h2>
    <ul class="scope-list">
      <li><strong>NetSuite validation:</strong> Each executed TC calls <code>verifyCashsaleDataFromNetsuite</code> — fetches the cash sale by Square eTail Order ID and validates line items (Item, Qty, Rate), body/header fields in the expected JSON, and zero-variance fields when applicable (<code>eTail Order/Discount/Tax/Ship Total Variance = 0</code>).</li>
      <li><strong>IO settings per TC:</strong> Each TC applies integration settings via <code>updateSettings0</code> (before order) and <code>updateSettings1</code> (on-demand sync) — tax mode, payment mapping, SKU track item, modifier preference, default customer, locations, etc. as defined per testcase.</li>
    </ul>
  </main>
  <footer>Square POS → NetSuite IA Order Import automation</footer>
  <script>
    const search = document.getElementById('search');
    const batchF = document.getElementById('filterBatch');
    const rows = [...document.querySelectorAll('#results tbody tr')];
    function applyFilters() {
      const q = (search.value || '').toLowerCase();
      const b = batchF.value;
      rows.forEach(r => {
        const text = r.textContent.toLowerCase();
        const matchQ = !q || text.includes(q);
        const matchB = !b || r.dataset.batch === b;
        r.style.display = matchQ && matchB ? '' : 'none';
      });
    }
    search.addEventListener('input', applyFilters);
    batchF.addEventListener('change', applyFilters);
  </script>
</body>
</html>`;
}

function main() {
  let logPaths = process.argv.slice(2).filter((p) => !p.startsWith("-"));
  if (logPaths.length === 0) {
    const discovered = discoverLogPaths();
    const tmpDefaults = [
      "/tmp/square_fullsuite_run.log",
      "/tmp/square_batches1-5.log",
      "/tmp/square_batch6.log",
    ].filter((p) => fs.existsSync(p));
    logPaths = tmpDefaults.length ? tmpDefaults : discovered;
  }

  const inventory = loadInventory();
  const mergedResults = new Map();
  let suiteSec = null;
  let jestSummary = null;

  // Process oldest logs first; newer logs override. PASS always beats FAIL.
  const sortedLogPaths = [...logPaths]
    .filter((p) => fs.existsSync(p))
    .sort((a, b) => (fs.statSync(a).mtimeMs || 0) - (fs.statSync(b).mtimeMs || 0));
  for (const logPath of sortedLogPaths) {
    const parsed = parseLogFile(logPath);
    if (parsed.suiteSec) suiteSec = parsed.suiteSec;
    if (parsed.summary?.total >= 100) jestSummary = parsed.summary;
    for (const [k, v] of parsed.results) {
      const prev = mergedResults.get(k) || {};
      const merged = { ...prev, ...v };
      if (prev.status === "PASS" || v.status === "PASS") merged.status = "PASS";
      else if (prev.status === "FAIL" || v.status === "FAIL") merged.status = "FAIL";
      // Keep richest ID data across log merges
      if (v.mapRaw) merged.mapRaw = v.mapRaw;
      else if (prev.mapRaw) merged.mapRaw = prev.mapRaw;
      if (v.cashSaleId) merged.cashSaleId = v.cashSaleId;
      else if (prev.cashSaleId) merged.cashSaleId = prev.cashSaleId;
      mergedResults.set(k, merged);
    }
  }

  const rows = inventory.map((item) => {
    const result = matchResult(item, mergedResults);
    if (!result) {
      return {
        ...item,
        status: "NOT_RUN",
        durationSec: null,
        reason: null,
        logFile: null,
        testTitle: item.testTitle,
        squareOrderId: null,
        squareOrderIds: [],
        cashSaleId: null,
      };
    }
    const ids = result.mapRaw
      ? extractOrderIdsFromMap(result.mapRaw, item.keyPrefixes)
      : {
          squareOrderId: result.squareOrderId || null,
          squareOrderIds: result.squareOrderIds || [],
          cashSaleId: result.cashSaleId || null,
        };
    return {
      ...item,
      testTitle: result.testTitle || item.testTitle,
      status: result.status || "NOT_RUN",
      durationSec: result.durationSec ?? (result.durationMs ? result.durationMs / 1000 : null),
      reason: result.reason || null,
      logFile: result.logFile || null,
      category: result.category || null,
      squareOrderId: ids.squareOrderId,
      squareOrderIds: ids.squareOrderIds,
      cashSaleId: result.cashSaleId || ids.cashSaleId || null,
    };
  });

  rows.sort((a, b) => {
    const ba = Number(a.batch) - Number(b.batch);
    if (ba !== 0) return ba;
    return a.test.localeCompare(b.test);
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outFile = path.join(OUT_DIR, `square_order_import_report_${ts}.html`);
  const html = buildHtml({
    inventory,
    rows,
    logs: logPaths.filter((p) => fs.existsSync(p)),
    generatedAt: new Date().toISOString(),
    envInfo: loadEnvInfo(),
    suiteSec,
    jestSummary,
  });
  fs.writeFileSync(outFile, html);

  // Also write latest symlink copy
  const latest = path.join(OUT_DIR, "square_order_import_report_latest.html");
  fs.writeFileSync(latest, html);

  console.log(outFile);
  console.log(latest);
  console.log(
    JSON.stringify(
      {
        inventory: inventory.length,
        passed: rows.filter((r) => r.status === "PASS").length,
        failed: rows.filter((r) => r.status === "FAIL").length,
        notRun: rows.filter((r) => r.status === "NOT_RUN").length,
        logsMerged: sortedLogPaths.length,
        batchesInReport: [
          ...new Set(rows.filter((r) => r.status === "PASS").map((r) => r.batch)),
        ].sort((a, b) => Number(a) - Number(b)),
      },
      null,
      2
    )
  );
}

const DEFAULT_FULLSUITE_LOGS = [
  "/tmp/square_fullsuite_run.log",
  "/tmp/square_fullsuite_resume.log",
  "/tmp/square_fullsuite_resume2.log",
  "/tmp/square_fullsuite_resume3.log",
  "/tmp/square_fullsuite_resume4.log",
];

function getMergedSuiteStats(logPaths = DEFAULT_FULLSUITE_LOGS) {
  const inventory = loadInventory();
  const mergedResults = new Map();
  const sorted = [...logPaths]
    .filter((p) => fs.existsSync(p))
    .sort((a, b) => (fs.statSync(a).mtimeMs || 0) - (fs.statSync(b).mtimeMs || 0));
  for (const logPath of sorted) {
    const parsed = parseLogFile(logPath);
    for (const [k, v] of parsed.results) {
      const prev = mergedResults.get(k) || {};
      const merged = { ...prev, ...v };
      if (prev.status === "PASS" || v.status === "PASS") merged.status = "PASS";
      else if (prev.status === "FAIL" || v.status === "FAIL") merged.status = "FAIL";
      mergedResults.set(k, merged);
    }
  }
  const rows = inventory.map((item) => {
    const result = matchResult(item, mergedResults);
    const meta = parseTitleMeta(item.testTitle);
    return {
      batch: item.batch,
      test: item.test,
      zephyr: item.zephyr,
      title: meta.title,
      status: result?.status || "NOT_RUN",
      durationSec: result?.durationSec ?? null,
      reason: result?.reason || null,
      category: result?.category || null,
    };
  });
  const passed = rows.filter((r) => r.status === "PASS").length;
  const failed = rows.filter((r) => r.status === "FAIL").length;
  const notRun = rows.filter((r) => r.status === "NOT_RUN").length;
  const batchStats = {};
  for (const r of rows) {
    const b = r.batch;
    if (!batchStats[b]) batchStats[b] = { pass: 0, fail: 0, notRun: 0, time: 0 };
    if (r.status === "PASS") {
      batchStats[b].pass++;
      batchStats[b].time += r.durationSec || 0;
    } else if (r.status === "FAIL") batchStats[b].fail++;
    else batchStats[b].notRun++;
  }
  const failures = rows
    .filter((r) => r.status === "FAIL")
    .map((r) => ({
      test: r.test,
      batch: r.batch,
      zephyr: r.zephyr,
      title: r.title,
      reason: r.reason || "See merged logs",
      category: r.category || "VALIDATION_FAILED",
    }));
  const suiteSec = rows
    .filter((r) => r.status === "PASS" || r.status === "FAIL")
    .reduce((s, r) => s + (r.durationSec || 0), 0);
  return {
    total: inventory.length,
    passed,
    failed,
    notRun,
    passRate: inventory.length ? Math.round((passed / inventory.length) * 100) : 0,
    suiteSec,
    logs: sorted.map((p) => path.basename(p)),
    batchStats,
    failures,
    rows,
  };
}

if (require.main === module) {
  main();
}

module.exports = {
  parseLogFile,
  matchResult,
  extractOrderIdsFromMap,
  fmtDuration,
  loadEnvInfo,
  parseTitleMeta,
  stripAnsi,
  logMessage,
  getMergedSuiteStats,
  DEFAULT_FULLSUITE_LOGS,
};
