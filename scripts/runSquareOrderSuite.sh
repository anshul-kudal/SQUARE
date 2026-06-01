#!/usr/bin/env bash
# Run full Square Order Import suite (Batches 1–9 + PRE25603 SC1 = 125 TCs).
#
# Usage:
#   npm run square:full              # quick profile (default)
#   SQUARE_QUICK=0 npm run square:full   # conservative idle waits
#   TAG='batch5|batch6' npm run square:full
set -euo pipefail
cd "$(dirname "$0")/.."

FULLSUITE_TAG="batch1|batch2|batch3|batch4|batch5|batch6|batch7|batch8|batch9|pre25603sc1"
TAG="${TAG:-fullsuite}"
if [ "$TAG" = "fullsuite" ]; then
  TAG="$FULLSUITE_TAG"
fi

export SQUARE_QUICK="${SQUARE_QUICK:-1}"
export SQUARE_FLOW_PROFILE="${SQUARE_FLOW_PROFILE:-quick}"
export TEST_MAX_RETRIES="${TEST_MAX_RETRIES:-4}"

IO_HOST="${IO_HOST:-iaqa.staging.integrator.io}"
LOG="/tmp/square_fullsuite_run.log"
STATE_FILE=".test-state/${FULLSUITE_TAG}.json"

echo "=============================================="
echo " Square Order Import — full suite (125 TCs)"
echo " TAG=${TAG}"
echo " Profile=${SQUARE_FLOW_PROFILE}  Retries=${TEST_MAX_RETRIES}"
echo " Log=${LOG}"
echo " Progress=report/square_fullsuite_progress.md"
echo "=============================================="

echo "[preflight] DNS check: ${IO_HOST}"
if ! node -e "require('dns').lookup('${IO_HOST}', e => process.exit(e ? 1 : 0))"; then
  echo "ERROR: Cannot resolve ${IO_HOST}. Check VPN/network and retry."
  exit 1
fi

echo "[preflight] HTTP check: https://${IO_HOST}"
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://${IO_HOST}/" || echo "000")
if [ "$HTTP_CODE" = "000" ]; then
  echo "ERROR: IO host unreachable (curl failed). Aborting."
  exit 1
fi
echo "[preflight] OK (HTTP ${HTTP_CODE})"

rm -f "$STATE_FILE" 2>/dev/null || true

# Regenerate testcase JSON with current flow profile when running full suite
if [ "$TAG" = "$FULLSUITE_TAG" ]; then
  echo "[gen] Regenerating batch JSON (profile=${SQUARE_FLOW_PROFILE})..."
  node scripts/generateSquareBatch1.js
  node scripts/generateSquareBatch2Batch3.js
  node scripts/generateSquareBatch4.js
  node scripts/generateSquareBatches5to9.js
fi

node scripts/watchSquareSuiteProgress.js "$LOG" &
PROGRESS_PID=$!
trap 'kill "$PROGRESS_PID" 2>/dev/null || true' EXIT

echo "[run] Starting jest..."
env NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite TAG="${TAG}" \
  npm run jest 2>&1 | tee "$LOG"
JEST_EXIT=${PIPESTATUS[0]}

kill "$PROGRESS_PID" 2>/dev/null || true
node scripts/watchSquareSuiteProgress.js "$LOG" || true

echo "[done] Exit code: ${JEST_EXIT}"
exit "${JEST_EXIT}"
