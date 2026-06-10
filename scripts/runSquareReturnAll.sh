#!/usr/bin/env bash
# Run Square Return suites in order: B0 smoke → R1 → R2.
# Fixes/refines refund indexing in helpers/squareDataCreation.js before run.
#
# Usage:
#   ./scripts/runSquareReturnAll.sh
#   PHASE=b0 ./scripts/runSquareReturnAll.sh   # smoke only
set -euo pipefail
cd "$(dirname "$0")/.."

export SUITE="Square_Suite/Return_Import"
export NODE_ENV="${NODE_ENV:-dev}"
export SETUP="${SETUP:-E2E_Square}"
export PBI="${PBI:-SQNS}"
export SQUARE_FLOW_PROFILE="${SQUARE_FLOW_PROFILE:-quick}"
export SQUARE_QUICK="${SQUARE_QUICK:-1}"
export TEST_MAX_RETRIES="${TEST_MAX_RETRIES:-4}"

IO_HOST="${IO_HOST:-iaqa.staging.integrator.io}"
LOG="/tmp/square_return_all.log"
PHASE="${PHASE:-all}"

echo "=============================================="
echo " Square Return — B0 → R1 → R2"
echo " PHASE=${PHASE}  Profile=${SQUARE_FLOW_PROFILE}"
echo " Log=${LOG}"
echo "=============================================="

echo "[preflight] DNS: ${IO_HOST}"
node -e "require('dns').lookup('${IO_HOST}', e => process.exit(e ? 1 : 0))" || exit 1

echo "[preflight] IO connection export (refund indexing)"
env NODE_ENV="${NODE_ENV}" SETUP="${SETUP}" PBI="${PBI}" node scripts/squareIoExportPreflight.js || exit 1

node scripts/generateSquareReturnSmoke.js
node scripts/generateSquareReturnBatch1.js
node scripts/generateSquareReturnBatch2.js

run_phase() {
  local tag="$1"
  local label="$2"
  echo ""
  echo "======== ${label} (TAG=${tag}) ========"
  rm -f ".test-state/${tag}.json" 2>/dev/null || true
  env NODE_ENV="${NODE_ENV}" SETUP="${SETUP}" PBI="${PBI}" SUITE="${SUITE}" TAG="${tag}" \
    SQUARE_FLOW_PROFILE="${SQUARE_FLOW_PROFILE}" SQUARE_QUICK="${SQUARE_QUICK}" \
    TEST_MAX_RETRIES="${TEST_MAX_RETRIES}" \
    npx jest --config ./jest.config.js --runInBand --forceExit 2>&1 | tee -a "${LOG}"
}

: > "${LOG}"

case "${PHASE}" in
  b0|B0)
    run_phase "return_smoke" "B0 smoke (10 TCs)"
    ;;
  r1|R1)
    run_phase "batchr1" "R1 (22 TCs)"
    ;;
  r2|R2)
    run_phase "batchr2" "R2 (24 TCs)"
    ;;
  *)
    run_phase "return_smoke" "B0 smoke (10 TCs)"
    run_phase "batchr1" "R1 (22 TCs)"
    run_phase "batchr2" "R2 (24 TCs)"
    ;;
esac

echo ""
echo "Complete. Full log: ${LOG}"
grep -E "^(PASS|FAIL) |TEST SUITE SUMMARY|Failed:|Passed:" "${LOG}" 2>/dev/null | tail -30 || true
