#!/usr/bin/env node
/**
 * Parse Jest Square suite log → markdown report with per-TC status, duration, errors.
 * Usage: node scripts/parseSquareSuiteReport.js /tmp/square_batches1-5.log
 */
const fs = require("fs");
const path = require("path");

const logPath = process.argv[2];
if (!logPath || !fs.existsSync(logPath)) {
  console.error("Usage: node scripts/parseSquareSuiteReport.js <log-file>");
  process.exit(1);
}

const raw = fs.readFileSync(logPath);
const text = raw.toString("utf8").replace(/\u001b\[[0-9;]*m/g, "");

const suiteTimeMatch = text.match(/Time:\s+([\d.]+)\s+s/);
const summaryMatch = text.match(/Passed:\s+(\d+)[\s\S]*?Failed:\s+(\d+)[\s\S]*?(?:Skipped:\s+(\d+))?/);
const totalMatch = text.match(/Total:\s+(\d+)/);

const passed = summaryMatch ? Number(summaryMatch[1]) : null;
const failed = summaryMatch ? Number(summaryMatch[2]) : null;
const skipped = summaryMatch ? Number(summaryMatch[3] || 0) : 0;
const total = totalMatch ? Number(totalMatch[1]) : (passed != null ? passed + failed + skipped : null);
const suiteSec = suiteTimeMatch ? Number(suiteTimeMatch[1]) : null;

const tcResults = new Map();

// Jest verbose pass/fail lines
for (const m of text.matchAll(/^\s*[✓✕]\s+(.+?)\s+\((\d+)\s+ms\)/gm)) {
  const full = m[1].trim();
  const ms = Number(m[2]);
  const status = text.includes(`✕ ${m[1]}`) ? "FAIL" : "PASS";
  tcResults.set(full, { full, ms, status: m[0].includes("✕") ? "FAIL" : "PASS" });
}

// Override failures from FAILED TESTS section
const failSection = text.split("FAILED TESTS:")[1];
if (failSection) {
  const failBlock = failSection.split("SLOW TESTS")[0] || failSection.split("-".repeat(70))[0];
  const failChunks = failBlock.split(/\n\s*[✗✕]\s+/).slice(1);
  for (const chunk of failChunks) {
    const lines = chunk.trim().split("\n");
    const name = lines[0].trim();
    const errLine = lines.find((l) => l.includes("→") || l.includes("Error:") || l.includes("timeout"));
    const reason = errLine
      ? errLine.replace(/^\s*→\s*/, "").trim()
      : lines.slice(1).join(" ").trim().slice(0, 300);
    const existing = tcResults.get(name) || { full: name, ms: null, status: "FAIL" };
    existing.status = "FAIL";
    existing.reason = reason;
    tcResults.set(name, existing);
  }
}

// Slow tests durations (backup for missing pass lines)
const slowSection = text.split("SLOW TESTS")[1];
if (slowSection) {
  for (const m of slowSection.matchAll(/⏱\s+([\d.]+)s\s+(.+)/g)) {
    const ms = Math.round(Number(m[1]) * 1000);
    const name = m[2].trim();
    if (!tcResults.has(name)) {
      tcResults.set(name, { full: name, ms, status: "PASS" });
    } else if (!tcResults.get(name).ms) {
      tcResults.get(name).ms = ms;
    }
  }
}

function parseMeta(full) {
  const zephyr = (full.match(/\[(PRE-T[^\]]+|PRE-25603[^\]]*)\]/i) || [])[1] || "—";
  const batch = (full.match(/\[Batch(\d+)\]/i) || [])[1] || "?";
  const titleMatch = full.match(/\]\s*-\s*(.+?)\s+with\s+\//);
  const title = titleMatch ? titleMatch[1] : full.split(" - ").slice(1).join(" - ").split(" with ")[0];
  const testId = (full.match(/(Batch\d+\w+)/) || [])[1] || "";
  return { batch, zephyr, title, testId };
}

const rows = [...tcResults.values()].sort((a, b) => a.full.localeCompare(b.full));

const outDir = path.join(process.cwd(), "report");
fs.mkdirSync(outDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outFile = path.join(outDir, `square_batches1-5_${ts}.md`);

const fmt = (ms) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)}s`);
const fmtSuite = (s) =>
  s == null ? "—" : s >= 3600 ? `${(s / 3600).toFixed(2)}h (${Math.round(s)}s)` : `${(s / 60).toFixed(1)} min (${Math.round(s)}s)`;

const passCount = rows.filter((r) => r.status === "PASS").length;
const failCount = rows.filter((r) => r.status === "FAIL").length;
const stability =
  failCount === 0 ? "**STABLE** — all executed tests passed" : `**UNSTABLE** — ${failCount} failure(s)`;

let md = `# Square Order Import — Batches 1–5 Run Report\n\n`;
md += `Generated: ${new Date().toISOString()}\n\n`;
md += `## Summary\n\n`;
md += `| Metric | Value |\n|--------|------:|\n`;
md += `| Total TCs (Batches 1–5) | 56 |\n`;
md += `| Executed (this run) | ${total ?? rows.length} |\n`;
md += `| Passed | ${passed ?? passCount} |\n`;
md += `| Failed | ${failed ?? failCount} |\n`;
md += `| Skipped | ${skipped} |\n`;
md += `| Suite wall time | ${fmtSuite(suiteSec)} |\n`;
md += `| Stability | ${stability} |\n\n`;

md += `### Batch breakdown (inventory)\n\n`;
md += `| Batch | TC count |\n|-------|--------:|\n`;
md += `| Batch 1 | 10 |\n| Batch 2 | 11 |\n| Batch 3 | 12 |\n| Batch 4 | 9 |\n| Batch 5 | 14 |\n| **Total** | **56** |\n\n`;

md += `## Per-TC Results\n\n`;
md += `| # | Batch | TC ID | Title | Status | Duration | Failure reason |\n`;
md += `|---|------:|-------|-------|--------|----------|----------------|\n`;

rows.forEach((r, i) => {
  const { batch, zephyr, title } = parseMeta(r.full);
  const reason = r.status === "FAIL" ? (r.reason || "See log").replace(/\|/g, "\\|").slice(0, 120) : "—";
  md += `| ${i + 1} | ${batch} | ${zephyr} | ${title.replace(/\|/g, "\\|")} | ${r.status} | ${fmt(r.ms)} | ${reason} |\n`;
});

if (failCount > 0) {
  md += `\n## Failure details\n\n`;
  rows
    .filter((r) => r.status === "FAIL")
    .forEach((r) => {
      md += `### ${parseMeta(r.full).zephyr} — ${parseMeta(r.full).title}\n\n`;
      md += `\`\`\`\n${r.reason || "No error excerpt captured"}\n\`\`\`\n\n`;
    });
}

md += `\n## Per-TC timing (slowest first)\n\n`;
md += `| Duration | TC |\n|----------|----|\n`;
[...rows]
  .filter((r) => r.ms != null)
  .sort((a, b) => b.ms - a.ms)
  .forEach((r) => {
    md += `| ${fmt(r.ms)} | ${parseMeta(r.full).zephyr} — ${parseMeta(r.full).title} |\n`;
  });

fs.writeFileSync(outFile, md);
console.log(outFile);
console.log(JSON.stringify({ total, passed, failed, suiteSec, outFile, rows: rows.length }, null, 2));
