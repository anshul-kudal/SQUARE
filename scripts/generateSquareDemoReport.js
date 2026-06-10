#!/usr/bin/env node
/**
 * Generate deep stakeholder HTML report for Square live-demo TC runs.
 *
 * Usage:
 *   node scripts/generateSquareDemoReport.js [logPath]
 *   (reads /tmp/square_demo_manifest.json for which TCs were selected)
 *
 * Output: report/square_demo_report_latest.html
 */
const fs = require("fs");
const path = require("path");
const {
  DEMO_LOG,
  DEMO_MANIFEST,
  DEMO_TCS,
  formatDemoSelectionLabel,
} = require("../helpers/squareDemoConfig");
const {
  parseLogFile,
  extractOrderIdsFromMap,
  fmtDuration,
  loadEnvInfo,
  stripAnsi,
  logMessage,
} = require("./generateSquareHtmlReport");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "report");

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadManifest() {
  if (!fs.existsSync(DEMO_MANIFEST)) {
    return { selection: "all", selectionRaw: "all", tcs: DEMO_TCS, log: DEMO_LOG };
  }
  return JSON.parse(fs.readFileSync(DEMO_MANIFEST, "utf8"));
}

function extractValidationsFromLog(logPath, testKey) {
  if (!fs.existsSync(logPath)) return [];
  const text = stripAnsi(fs.readFileSync(logPath, "utf8"));
  const lines = [];
  let inTc = false;
  for (const raw of text.split("\n")) {
    const line = logMessage(raw);
    if (line.includes(`Running Test Case`) && line.includes(testKey)) inTc = true;
    if (inTc && line.includes("Running Test Case") && !line.includes(testKey)) break;
    if (inTc && line.includes("Validation Completed: Expected JSON >>")) {
      lines.push(line.replace(/.*Validation Completed: Expected JSON >>\s*/, "").trim());
    }
    if (inTc && line.includes("Test completed in")) break;
  }
  return lines;
}

function extractTcTimeline(logPath, testKey) {
  if (!fs.existsSync(logPath)) return { startedAt: null, completedAt: null };
  let startedAt = null;
  let completedAt = null;
  let inTc = false;
  for (const raw of fs.readFileSync(logPath, "utf8").split("\n")) {
    const trimmed = stripAnsi(raw).trim();
    let ts = null;
    let msg = trimmed;
    if (trimmed.startsWith("{")) {
      try {
        const j = JSON.parse(trimmed);
        ts = j.timestamp || null;
        msg = j.message || trimmed;
      } catch {
        /* plain */
      }
    }
    if (msg.includes("Running Test Case") && msg.includes(testKey)) {
      inTc = true;
      startedAt = ts || startedAt;
    }
    if (inTc && msg.includes("Test completed in")) {
      completedAt = ts || completedAt;
      break;
    }
    if (inTc && msg.includes("Running Test Case") && !msg.includes(testKey)) break;
  }
  return { startedAt, completedAt };
}

function parseValidationFields(validations) {
  const out = { eTailOrderId: null, variances: {} };
  for (const v of validations) {
    try {
      const o = JSON.parse(v);
      if (o["eTail Order Id"]) out.eTailOrderId = o["eTail Order Id"];
      for (const k of Object.keys(o)) {
        if (/variance/i.test(k)) out.variances[k] = o[k];
      }
    } catch {
      /* not json */
    }
  }
  return out;
}

function findLogResult(demoTc, resultsMap) {
  for (const [title, data] of resultsMap) {
    if (title.includes(demoTc.key) || title.includes(`[${demoTc.zephyr}]`)) {
      return { ...data, testTitle: title };
    }
  }
  return null;
}

function orderKeyPrefix(demoTc) {
  const m = demoTc.payloadDir.match(/\/(PRET\d+[A-Z0-9]*|PRE25603[A-Z0-9]*)(?:\/|$)/i);
  return m ? m[1] : `PRET${demoTc.zephyr.replace("PRE-T", "")}`;
}

function buildRow(demoTc, result, validations, envInfo, logPath) {
  const prefix = orderKeyPrefix(demoTc);
  const keyPrefixes = [prefix];
  const ids = result?.mapRaw
    ? extractOrderIdsFromMap(result.mapRaw, keyPrefixes)
    : {
        squareOrderId: result?.squareOrderId || null,
        squareOrderIds: result?.squareOrderIds || [],
        cashSaleId: result?.cashSaleId || null,
      };
  const onDemandKey =
    result?.mapRaw?.[`${prefix}onDemandOrderSync`] ||
    result?.mapRaw?.[`${prefix}onDemandOrderSyncKey`] ||
    null;
  const status = result?.status || "NOT_RUN";
  const durationSec = result?.durationSec ?? null;
  const valFields = parseValidationFields(validations);
  const timeline = extractTcTimeline(logPath, demoTc.key);
  const squareOrderId =
    ids.squareOrderId || valFields.eTailOrderId || (ids.squareOrderIds?.[0] ?? null);
  const nsOrderId = result?.cashSaleId || ids.cashSaleId || null;

  return {
    ...demoTc,
    tcId: demoTc.zephyr,
    demoLabel: `Demo TC ${demoTc.num}`,
    status,
    durationSec,
    durationFmt: durationSec != null ? fmtDuration(durationSec) : "—",
    runTime: durationSec != null ? fmtDuration(durationSec) : "—",
    squareOrderId,
    nsOrderId,
    nsOrderIdLabel: nsOrderId ? String(nsOrderId) : "—",
    onDemandKey,
    validations,
    valFields,
    reason: result?.reason || null,
    testTitle: result?.testTitle || demoTc.key,
    nsAccount: envInfo.nsAccount || "—",
    ioEnvironment: envInfo.ioEnvironment || "—",
    integration: envInfo.integration || "—",
    startedAt: timeline.startedAt,
    completedAt: timeline.completedAt,
    logFile: result?.logFile || path.basename(logPath),
  };
}

function copyBtn(id, value) {
  if (!value || value === "—") return "";
  return `<button type="button" class="copy-btn" data-copy="${esc(value)}" title="Copy">Copy</button>`;
}

function buildHtml({ rows, manifest, logPath, generatedAt, envInfo, suiteSec }) {
  const executed = rows.filter((r) => r.status !== "NOT_RUN");
  const passed = rows.filter((r) => r.status === "PASS").length;
  const failed = rows.filter((r) => r.status === "FAIL").length;
  const totalSec = suiteSec ?? executed.reduce((s, r) => s + (r.durationSec || 0), 0);
  const selectionLabel =
    manifest.selection ||
    formatDemoSelectionLabel(manifest.tcs) ||
    manifest.selectionRaw ||
    "—";
  const runWindow =
    manifest.startedAt && manifest.finishedAt
      ? `${manifest.startedAt} → ${manifest.finishedAt}`
      : manifest.startedAt || "—";

  const summaryCards = `
    <div class="card pass"><div class="label">Passed</div><div class="value">${passed}</div></div>
    <div class="card fail"><div class="label">Failed</div><div class="value">${failed}</div></div>
    <div class="card"><div class="label">TCs executed</div><div class="value">${executed.length}/${rows.length}</div></div>
    <div class="card time"><div class="label">Total run time</div><div class="value">${esc(fmtDuration(totalSec))}</div></div>`;

  const tableRows = rows
    .map(
      (r) => `<tr class="row-${r.status === "PASS" ? "pass" : r.status === "FAIL" ? "fail" : "pending"}">
    <td class="num"><strong>${r.num}</strong></td>
    <td><code class="tc-id">${esc(r.tcId)}</code></td>
    <td><code>${esc(r.key)}</code></td>
    <td>${esc(r.desc)}</td>
    <td><span class="badge ${r.status === "PASS" ? "pass" : r.status === "FAIL" ? "fail" : "pending"}">${esc(r.status)}</span></td>
    <td class="num">${esc(r.runTime)}</td>
    <td class="mono id-cell">${r.squareOrderId ? `<span>${esc(r.squareOrderId)}</span>${copyBtn("sq" + r.num, r.squareOrderId)}` : "—"}</td>
    <td class="mono id-cell">${r.nsOrderId ? `<span>${esc(r.nsOrderIdLabel)}</span>${copyBtn("ns" + r.num, r.nsOrderIdLabel)}` : "—"}</td>
  </tr>`
    )
    .join("\n");

  const detailCards = rows
    .map((r) => {
      const valList =
        r.validations.length > 0
          ? `<ul class="val-list">${r.validations
              .map((v) => `<li><pre class="val-json">${esc(v)}</pre></li>`)
              .join("")}</ul>`
          : `<p class="muted">Expected: ${esc(r.validates)}</p>`;

      const varianceRows = Object.entries(r.valFields.variances || {})
        .map(
          ([k, v]) =>
            `<tr><td>${esc(k)}</td><td class="num ${v === "0" || v === 0 ? "ok" : "bad"}">${esc(v)}</td></tr>`
        )
        .join("");

      return `<article class="tc-card status-${esc(r.status)}" id="tc-${r.num}">
  <header>
    <span class="demo-num">${esc(r.demoLabel)}</span>
    <code class="tc-id-pill">${esc(r.tcId)}</code>
    <span class="badge ${r.status === "PASS" ? "pass" : r.status === "FAIL" ? "fail" : "pending"}">${esc(r.status)}</span>
    <span class="duration" title="Run time">⏱ ${esc(r.runTime)}</span>
  </header>
  <h3>${esc(r.desc)}</h3>
  <p class="meta"><code>${esc(r.key)}</code> · Batch ${r.batch} · ${esc(r.estTime)} est · Handler <code>${esc(r.handler)}</code></p>

  <div class="kv-table-wrap">
    <table class="kv-table">
      <tbody>
        <tr><th>TC ID (Zephyr)</th><td><code>${esc(r.tcId)}</code></td></tr>
        <tr><th>Description</th><td>${esc(r.desc)}</td></tr>
        <tr><th>Status</th><td><span class="badge ${r.status === "PASS" ? "pass" : r.status === "FAIL" ? "fail" : "pending"}">${esc(r.status)}</span></td></tr>
        <tr><th>Run time</th><td>${esc(r.runTime)}</td></tr>
        <tr><th>Started (log)</th><td>${r.startedAt ? esc(r.startedAt) : "—"}</td></tr>
        <tr><th>Completed (log)</th><td>${r.completedAt ? esc(r.completedAt) : "—"}</td></tr>
        <tr><th>Square Order ID</th><td class="mono id-cell">${r.squareOrderId ? esc(r.squareOrderId) + copyBtn("d-sq" + r.num, r.squareOrderId) : "—"}</td></tr>
        <tr><th>NS Order ID (Cash Sale)</th><td class="mono id-cell">${r.nsOrderId ? esc(r.nsOrderIdLabel) + copyBtn("d-ns" + r.num, r.nsOrderIdLabel) : "—"}</td></tr>
        <tr><th>On-demand sync key</th><td class="mono">${r.onDemandKey ? esc(r.onDemandKey) : "—"}</td></tr>
        <tr><th>NetSuite account</th><td><code>${esc(r.nsAccount)}</code></td></tr>
        <tr><th>What we validate</th><td>${esc(r.validates)}</td></tr>
      </tbody>
    </table>
  </div>

  ${
    varianceRows
      ? `<h4>Variance checks (from log)</h4><table class="mini-table"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${varianceRows}</tbody></table>`
      : ""
  }

  <h4>NetSuite validation payload (from log)</h4>
  ${valList}
  ${r.reason ? `<div class="fail-reason"><strong>Failure reason:</strong> ${esc(r.reason)}</div>` : ""}
  <details><summary>Test data &amp; artifacts</summary>
    <p><code>${esc(r.payloadDir)}/</code></p>
    <ul>
      <li><code>${esc(r.key)}_createOrder.json</code></li>
      <li><code>${esc(r.key)}_expectedResponse1.json</code></li>
      <li><code>${esc(r.key)}_updateSettings0.json</code> / <code>_updateSettings1.json</code></li>
    </ul>
    <p class="muted">Full title: ${esc(r.testTitle)}</p>
  </details>
</article>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Square Live Demo — Deep Run Report</title>
<style>
:root{--bg:#0a0e17;--surface:#121a28;--surface2:#1a2538;--text:#e8edf5;--muted:#8fa3be;--accent:#60a5fa;--pass:#34d399;--fail:#f87171;--pending:#fbbf24;--border:#2a3a52;--ok:#34d399}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);line-height:1.55}
header{padding:2rem 2rem 1.5rem;border-bottom:1px solid var(--border);background:linear-gradient(135deg,#1e3a5f 0%,#0a0e17 55%)}
header h1{margin:0 0 .35rem;font-size:1.65rem}
header .sub{color:var(--muted);margin:.2rem 0;font-size:.92rem}
.nav a{color:var(--accent);margin-right:1.25rem;font-size:.88rem;text-decoration:none}
.nav a:hover{text-decoration:underline}
main{max-width:1280px;margin:0 auto;padding:2rem 1.5rem 3rem}
.muted{color:var(--muted)}
.env-panel{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem 1.25rem;margin:1.25rem 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.75rem 1.5rem;font-size:.85rem}
.env-panel div span{display:block;font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1rem;margin:1.25rem 0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;text-align:center}
.card .label{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.card .value{font-size:1.55rem;font-weight:700;margin-top:.2rem}
.card.pass .value{color:var(--pass)}.card.fail .value{color:var(--fail)}.card.time .value{font-size:1.15rem}
h2{font-size:1.2rem;margin:2rem 0 .75rem;padding-bottom:.4rem;border-bottom:1px solid var(--border)}
.master-table{width:100%;border-collapse:collapse;font-size:.86rem;margin:1rem 0}
.master-table th,.master-table td{border:1px solid var(--border);padding:.5rem .6rem;text-align:left;vertical-align:middle}
.master-table th{background:var(--surface2);font-size:.75rem;text-transform:uppercase;letter-spacing:.03em;color:var(--muted)}
.master-table .num{text-align:center}
.row-pass{background:rgba(52,211,153,.05)}.row-fail{background:rgba(248,113,113,.08)}
.mono{font-family:ui-monospace,Menlo,monospace;font-size:.8rem;word-break:break-all}
.tc-id{color:var(--accent);font-weight:600}
.badge{display:inline-block;padding:.2em .55em;border-radius:6px;font-size:.72rem;font-weight:700;text-transform:uppercase}
.badge.pass{background:rgba(52,211,153,.18);color:var(--pass)}
.badge.fail{background:rgba(248,113,113,.2);color:var(--fail)}
.badge.pending{background:rgba(251,191,36,.15);color:var(--pending)}
.id-cell{display:flex;align-items:center;gap:.4rem;flex-wrap:wrap}
.copy-btn{font-size:.68rem;padding:.15em .45em;border-radius:4px;border:1px solid var(--border);background:var(--surface2);color:var(--accent);cursor:pointer}
.copy-btn:hover{background:var(--accent);color:#0a0e17}
.tc-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:1.35rem 1.5rem;margin:1.5rem 0}
.tc-card.status-PASS{border-left:4px solid var(--pass)}
.tc-card.status-FAIL{border-left:4px solid var(--fail)}
.tc-card.status-NOT_RUN{border-left:4px solid var(--pending)}
.tc-card header{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.35rem}
.demo-num{font-weight:700;color:var(--accent);font-size:1rem}
.tc-id-pill{background:var(--surface2);padding:.15em .5em;border-radius:6px;font-size:.8rem}
.duration{margin-left:auto;color:var(--muted);font-variant-numeric:tabular-nums}
.tc-card h3{margin:.4rem 0;font-size:1.08rem}
.meta{font-size:.82rem;color:var(--muted);margin:0 0 1rem}
.kv-table{width:100%;border-collapse:collapse;font-size:.88rem;margin:.75rem 0}
.kv-table th,.kv-table td{border:1px solid var(--border);padding:.45rem .65rem;text-align:left;vertical-align:top}
.kv-table th{width:28%;background:var(--surface2);color:var(--muted);font-weight:500}
.mini-table{width:auto;font-size:.82rem;border-collapse:collapse;margin:.5rem 0}
.mini-table th,.mini-table td{border:1px solid var(--border);padding:.35rem .55rem}
.mini-table .ok{color:var(--ok)}.mini-table .bad{color:var(--fail)}
.val-list{margin:0;padding-left:1.1rem}
.val-json{margin:.35rem 0;font-size:.75rem;white-space:pre-wrap;word-break:break-word;background:var(--surface2);padding:.5rem;border-radius:6px;border:1px solid var(--border)}
.fail-reason{background:rgba(248,113,113,.1);border:1px solid var(--fail);border-radius:8px;padding:.85rem;margin-top:1rem;font-size:.88rem}
details{margin-top:1rem;font-size:.86rem}
details summary{cursor:pointer;color:var(--accent);font-weight:500}
footer{text-align:center;padding:2.5rem 1rem;color:var(--muted);font-size:.82rem;border-top:1px solid var(--border)}
.toast{position:fixed;bottom:1.5rem;right:1.5rem;background:var(--pass);color:#052e1a;padding:.5rem 1rem;border-radius:8px;font-size:.85rem;opacity:0;transition:opacity .2s;pointer-events:none;z-index:99}
.toast.show{opacity:1}
</style>
</head>
<body>
<header>
  <h1>Square → NetSuite — Deep Demo Report</h1>
  <p class="sub">Request: <strong>${esc(manifest.selectionRaw || selectionLabel)}</strong> · Ran: <strong>${esc(selectionLabel)}</strong></p>
  <p class="sub">Generated ${esc(generatedAt)} · Run window: ${esc(runWindow)}</p>
  <p class="nav">
    <a href="square-demo-guide.html">Demo Guide</a>
    <a href="square-automation-guide.html">Team Guide</a>
    <a href="square_order_import_report_latest.html">Full Suite Report</a>
  </p>
</header>
<main>
  <div class="env-panel">
    <div><span>IO environment</span>${esc(envInfo.ioEnvironment)}</div>
    <div><span>Integration</span>${esc(envInfo.integration)}</div>
    <div><span>NetSuite account</span><code>${esc(envInfo.nsAccount)}</code></div>
    <div><span>Square store</span>${esc(envInfo.squareStore || "—")}</div>
    <div><span>Log file</span><code>${esc(path.basename(logPath))}</code></div>
    <div><span>Jest exit</span>${manifest.jestExit != null ? esc(String(manifest.jestExit)) : "—"}</div>
  </div>

  <h2>Run summary</h2>
  <div class="cards">${summaryCards}</div>

  <h2>All results — TC ID · description · run time · status · IDs</h2>
  <div style="overflow-x:auto">
  <table class="master-table">
    <thead><tr>
      <th>#</th><th>TC ID</th><th>Test key</th><th>Description</th><th>Status</th><th>Run time</th>
      <th>Square Order ID</th><th>NS Order ID</th>
    </tr></thead>
    <tbody>${tableRows || "<tr><td colspan=\"8\">No data</td></tr>"}</tbody>
  </table>
  </div>

  <h2>Per-TC deep dive</h2>
  <p class="muted">Use Square Order ID in Square Dashboard → Orders. NS Order ID is the NetSuite Cash Sale internal ID (eTail Order Id links to Square).</p>
  ${detailCards || "<p>No demo TC data.</p>"}
</main>
<footer>Square POS → Integrator.io → NetSuite · Deep demo report · <a href="#tc-1" style="color:var(--accent)">Jump to TC 1</a></footer>
<div class="toast" id="copy-toast">Copied</div>
<script>
document.querySelectorAll('.copy-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const v=btn.getAttribute('data-copy');
    if(!v)return;
    navigator.clipboard.writeText(v).then(()=>{
      const t=document.getElementById('copy-toast');
      t.textContent='Copied: '+v.slice(0,24)+(v.length>24?'…':'');
      t.classList.add('show');
      setTimeout(()=>t.classList.remove('show'),1600);
    });
  });
});
</script>
</body>
</html>`;
}

/**
 * Parse a run log + manifest into per-TC rows (status, order IDs, validations).
 * Shared by the HTML report and the Zephyr publisher.
 */
function buildRows(logPath, manifestArg) {
  const manifest = manifestArg || loadManifest();
  const selected = manifest.tcs?.length ? manifest.tcs : DEMO_TCS;
  const envInfo = loadEnvInfo();

  const { results, suiteSec } = parseLogFile(logPath);
  const resultsMap = results instanceof Map ? results : new Map(Object.entries(results || {}));

  const rows = selected.map((demoTc) => {
    const result = findLogResult(demoTc, resultsMap);
    const validations = extractValidationsFromLog(logPath, demoTc.key);
    return buildRow(demoTc, result, validations, envInfo, logPath);
  });

  return { rows, manifest, envInfo, suiteSec };
}

function main() {
  const logPath = process.argv[2] || DEMO_LOG;
  const { rows, manifest, envInfo, suiteSec } = buildRows(logPath);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const html = buildHtml({
    rows,
    manifest,
    logPath,
    generatedAt: new Date().toISOString(),
    envInfo,
    suiteSec,
  });

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const stamped = path.join(OUT_DIR, `square_demo_report_${ts}.html`);
  const latest = path.join(OUT_DIR, "square_demo_report_latest.html");
  fs.writeFileSync(stamped, html);
  fs.writeFileSync(latest, html);

  console.log(stamped);
  console.log(latest);
  console.log(
    JSON.stringify(
      {
        selection: manifest.selection,
        selectionRaw: manifest.selectionRaw,
        passed: rows.filter((r) => r.status === "PASS").length,
        failed: rows.filter((r) => r.status === "FAIL").length,
        notRun: rows.filter((r) => r.status === "NOT_RUN").length,
        rows: rows.map((r) => ({
          num: r.num,
          tcId: r.tcId,
          description: r.desc,
          status: r.status,
          runTime: r.runTime,
          squareOrderId: r.squareOrderId,
          nsOrderId: r.nsOrderId,
        })),
      },
      null,
      2
    )
  );
}

if (require.main === module) {
  main();
}

module.exports = { buildRows, loadManifest };
