#!/usr/bin/env bash
# Phase B0 — run 10 Square Return/Refund smoke TCs (20 interactions).
#
# Usage:
#   ./scripts/runSquareReturnSmoke.sh
#   TAG='return_smoke' RESUME='BatchR0Smoke03Refund' ./scripts/runSquareReturnSmoke.sh
set -euo pipefail
cd "$(dirname "$0")/.."

export SUITE="Square_Suite/Return_Import"
export TAG="${TAG:-return_smoke}"
export NODE_ENV="${NODE_ENV:-dev}"
export SETUP="${SETUP:-E2E_Square}"
export PBI="${PBI:-SQNS}"
export SQUARE_FLOW_PROFILE="${SQUARE_FLOW_PROFILE:-quick}"
export SQUARE_QUICK="${SQUARE_QUICK:-1}"
export TEST_MAX_RETRIES="${TEST_MAX_RETRIES:-3}"

LOG="/tmp/square_return_smoke.log"

echo "=============================================="
echo " Square Return/Refund — B0 smoke (10 TCs)"
echo " SUITE=${SUITE}  TAG=${TAG}"
echo " Profile=${SQUARE_FLOW_PROFILE}"
echo " Log=${LOG}"
echo "=============================================="

env NODE_ENV="${NODE_ENV}" SETUP="${SETUP}" PBI="${PBI}" node scripts/squareIoExportPreflight.js

node scripts/generateSquareReturnSmoke.js

rm -f ".test-state/${TAG}.json" 2>/dev/null || true

env NODE_ENV="${NODE_ENV}" SETUP="${SETUP}" PBI="${PBI}" SUITE="${SUITE}" TAG="${TAG}" \
  SQUARE_FLOW_PROFILE="${SQUARE_FLOW_PROFILE}" SQUARE_QUICK="${SQUARE_QUICK}" \
  TEST_MAX_RETRIES="${TEST_MAX_RETRIES}" \
  npx jest --config ./jest.config.js --runInBand --forceExit 2>&1 | tee "$LOG"

echo ""
echo "Done. Log: ${LOG}"
