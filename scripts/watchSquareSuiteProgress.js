#!/usr/bin/env node
/**
 * Live progress for Square full-suite runs.
 * Writes report/square_fullsuite_progress.md every 30s while jest is running.
 *
 * Usage: node scripts/watchSquareSuiteProgress.js [logPath]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LOG = process.argv[2] || "/tmp/square_fullsuite_run.log";
const OUT = path.join(ROOT, "report/square_fullsuite_progress.md");
const TOTAL = 125;
const INTERVAL_MS = 30000;

function stripAnsi(s) {
  return s.replace(/\u001b\[[0-9;]*m/g, "");
}

function parseLog(text) {
  const clean = stripAnsi(text);
  const started = [];
  const completed = [];
  const passes = [];
  const fails = [];

  for (const line of clean.split("\n")) {
    const runM = line.match(/Running Test Case : (.+?)(?: \(attempt \d+\))?$/);
    if (runM) started.push(runM[1].trim());

    const doneM = line.match(/Test completed in ([\d.]+)s/);
    if (doneM) completed.push(parseFloat(doneM[1]));

    const passM = line.match(/^\s*✓ (.+?) with /);
    if (passM) passes.push(passM[1].trim());

    const failM = line.match(/^\s*✕ (.+?) with /);
    if (failM) fails.push(failM[1].trim());

    if (/Tests:\s+(\d+) failed, (\d+) passed, (\d+) total/.test(line)) {
      const m = line.match(/Tests:\s+(\d+) failed, (\d+) passed, (\d+) total/);
      return {
        done: true,
        failed: parseInt(m[1], 10),
        passed: parseInt(m[2], 10),
        total: parseInt(m[3], 10),
        current: null,
        started: started.length,
        elapsedMin: null,
        summaryLine: line.trim(),
      };
    }
  }

  const firstTs = clean.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
  const lastTs = [...clean.matchAll(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/g)].pop()?.[1];
  let elapsedMin = null;
  if (firstTs && lastTs) {
    const t0 = new Date(firstTs[1].replace(/:(\d{3})$/, ".$1"));
    const t1 = new Date(lastTs.replace(/:(\d{3})$/, ".$1"));
    elapsedMin = Math.max(0, (t1 - t0) / 60000);
  }

  const current = started[started.length - 1] || null;
  const doneCount = Math.max(completed.length, passes.length + fails.length);
  const avgSec =
    completed.length > 0
      ? completed.reduce((a, b) => a + b, 0) / completed.length
      : null;
  const etaMin =
    avgSec && doneCount < TOTAL
      ? ((TOTAL - doneCount) * avgSec) / 60
      : null;

  return {
    done: false,
    failed: fails.length,
    passed: passes.length,
    total: TOTAL,
    current,
    started: started.length,
    elapsedMin,
    etaMin,
    avgSec,
    doneCount,
    recentFails: fails.slice(-5),
    recentPasses: passes.slice(-3),
  };
}

function render(state) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const pct = state.doneCount
    ? Math.round((state.doneCount / TOTAL) * 100)
    : state.started
      ? Math.round((state.started / TOTAL) * 100)
      : 0;

  let body = `# Square Full Suite — Live Progress\n\n`;
  body += `**Updated:** ${now} UTC\n\n`;
  body += `| Metric | Value |\n|--------|------:|\n`;
  body += `| Progress | **${state.doneCount || state.started || 0} / ${TOTAL}** (${pct}%) |\n`;
  body += `| Passed | **${state.passed}** |\n`;
  body += `| Failed | **${state.failed}** |\n`;
  if (state.elapsedMin != null) {
    body += `| Elapsed | **${state.elapsedMin.toFixed(1)} min** |\n`;
  }
  if (state.avgSec != null) {
    body += `| Avg TC time | **${(state.avgSec / 60).toFixed(1)} min** |\n`;
  }
  if (state.etaMin != null) {
    body += `| ETA (est.) | **~${state.etaMin.toFixed(0)} min** |\n`;
  }
  body += `\n`;

  if (state.done && state.summaryLine) {
    body += `## ✅ Run finished\n\n\`${state.summaryLine}\`\n\n`;
  } else if (state.current) {
    body += `## 🔄 Current test\n\n\`${state.current}\`\n\n`;
  }

  if (state.recentPasses?.length) {
    body += `### Recent passes\n`;
    for (const p of state.recentPasses) body += `- ✓ ${p}\n`;
    body += `\n`;
  }
  if (state.recentFails?.length) {
    body += `### Recent failures\n`;
    for (const f of state.recentFails) body += `- ✕ ${f}\n`;
    body += `\n`;
  }

  body += `---\n*Log:* \`${LOG}\`\n`;
  return body;
}

function tick() {
  if (!fs.existsSync(LOG)) return;
  const text = fs.readFileSync(LOG, "utf8");
  const state = parseLog(text);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, render(state));
  if (state.done) {
    console.log(`[progress] Run complete — ${state.passed} passed, ${state.failed} failed`);
    process.exit(0);
  }
}

console.log(`[progress] Watching ${LOG} → ${OUT}`);
tick();
const timer = setInterval(tick, INTERVAL_MS);

process.on("SIGINT", () => {
  clearInterval(timer);
  process.exit(0);
});
