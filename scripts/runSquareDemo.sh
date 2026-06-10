#!/usr/bin/env bash
# Run Square live-demo test case(s) and generate a deep HTML report.
#
# Usage (numbers or natural language):
#   ./scripts/runSquareDemo.sh 1
#   ./scripts/runSquareDemo.sh 1-2
#   ./scripts/runSquareDemo.sh "run TC 1"
#   ./scripts/runSquareDemo.sh "run 1st and 2nd"
#   ./scripts/runSquareDemo.sh all
#
# npm run square:demo -- "run TC 1"
#
# Report: report/square_demo_report_latest.html

set -euo pipefail
cd "$(dirname "$0")/.."

SELECTION="${*:-1}"
DEMO_LOG="/tmp/square_demo_run.log"
DEMO_MANIFEST="/tmp/square_demo_manifest.json"

read -r JEST_PATTERN TAG <<< "$(node -e "
const fs=require('fs');
const c=require('./helpers/squareDemoConfig');
const sel=process.argv.slice(1).join(' ').trim()||'1';
const selected=c.parseDemoSelection(sel);
if(!selected.length){
  process.stderr.write('Could not parse demo selection: \"'+sel+'\"\\n');
  process.stderr.write('Examples: 1 | 1-2 | run TC 1 | run 1st and 2nd | all\\n');
  process.exit(1);
}
fs.writeFileSync('${DEMO_MANIFEST}', JSON.stringify({
  selectionRaw: sel,
  selection: c.formatDemoSelectionLabel(selected),
  selectionNums: selected.map(t=>t.num),
  startedAt: new Date().toISOString(),
  log: '${DEMO_LOG}',
  tcs: selected,
}, null, 2));
process.stdout.write(c.jestPatternForSelection(selected)+'\\t'+c.tagsForSelection(selected));
" "$@")"

echo "=============================================="
echo " Square Live Demo Run"
echo " You asked:      ${SELECTION}"
node -e "
const c=require('./helpers/squareDemoConfig');
const sel=process.argv.slice(1).join(' ').trim()||'1';
const selected=c.parseDemoSelection(sel);
console.log(' Running:      '+c.formatDemoSelectionLabel(selected));
selected.forEach(t=>console.log('   • TC '+t.num+': '+t.key+' ('+t.zephyr+')'));
" "$@"
echo " Jest filter:  -t \"${JEST_PATTERN}\""
echo " TAG:          ${TAG}"
echo " Log:          ${DEMO_LOG}"
echo "=============================================="

set +e
env NODE_ENV=dev SETUP=E2E_Square SUITE=Square_Suite PBI=SQNS \
  SQUARE_FLOW_PROFILE=quick SQUARE_QUICK=1 TEST_MAX_RETRIES=1 TAG="${TAG}" \
  npm run jest -- -t "${JEST_PATTERN}" 2>&1 | tee "${DEMO_LOG}"
JEST_EXIT=${PIPESTATUS[0]}
set -e

node -e "
const fs=require('fs');
const p='${DEMO_MANIFEST}';
if(fs.existsSync(p)){
  const m=JSON.parse(fs.readFileSync(p,'utf8'));
  m.finishedAt=new Date().toISOString();
  m.jestExit=${JEST_EXIT};
  fs.writeFileSync(p,JSON.stringify(m,null,2));
}
"

echo ""
echo "Generating deep demo report..."
node scripts/generateSquareDemoReport.js "${DEMO_LOG}"

REPORT="$(pwd)/report/square_demo_report_latest.html"
echo ""
echo "=============================================="
echo " Demo report:"
echo " file://${REPORT}"
echo "=============================================="

if command -v open >/dev/null 2>&1; then
  open "${REPORT}" 2>/dev/null || true
fi

# Opt-in: publish results to a Zephyr Scale test cycle (cycle + executions +
# Pass/Fail + comment with order IDs). Enable with ZEPHYR_PUBLISH=1.
if [ "${ZEPHYR_PUBLISH:-0}" = "1" ]; then
  echo ""
  echo "Publishing results to Zephyr Scale..."
  node scripts/publishToZephyr.js "${DEMO_LOG}" || echo "[Zephyr] Publish step reported an issue (see above)."
fi

exit "${JEST_EXIT}"
