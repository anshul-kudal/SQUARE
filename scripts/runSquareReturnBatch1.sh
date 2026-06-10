#!/usr/bin/env bash
# Batch R1 — 22 single-line full/partial refund TCs (44 interactions).
#
# Usage:
#   ./scripts/runSquareReturnBatch1.sh
#   TAG=batchr1 RESUME='BatchR1FullBaselineRefund:5' ./scripts/runSquareReturnBatch1.sh
set -euo pipefail
cd "$(dirname "$0")/.."

export SUITE="Square_Suite/Return_Import"
export TAG="${TAG:-batchr1}"
export NODE_ENV="${NODE_ENV:-dev}"
export SETUP="${SETUP:-E2E_Square}"
export PBI="${PBI:-SQNS}"
export SQUARE_FLOW_PROFILE="${SQUARE_FLOW_PROFILE:-quick}"
export SQUARE_QUICK="${SQUARE_QUICK:-1}"
export TEST_MAX_RETRIES="${TEST_MAX_RETRIES:-3}"

LOG="/tmp/square_return_batch1.log"

echo "=============================================="
echo " Square Return/Refund — Batch R1 (22 TCs)"
echo " SUITE=${SUITE}  TAG=${TAG}"
echo " Profile=${SQUARE_FLOW_PROFILE}"
echo " Log=${LOG}"
echo "=============================================="

env NODE_ENV="${NODE_ENV}" SETUP="${SETUP}" PBI="${PBI}" node scripts/squareIoExportPreflight.js

node scripts/generateSquareReturnBatch1.js

rm -f ".test-state/${TAG}.json" 2>/dev/null || true

env NODE_ENV="${NODE_ENV}" SETUP="${SETUP}" PBI="${PBI}" SUITE="${SUITE}" TAG="${TAG}" \
  SQUARE_FLOW_PROFILE="${SQUARE_FLOW_PROFILE}" SQUARE_QUICK="${SQUARE_QUICK}" \
  TEST_MAX_RETRIES="${TEST_MAX_RETRIES}" \
  npx jest --config ./jest.config.js --runInBand --forceExit 2>&1 | tee "$LOG"

echo ""
echo "Done. Log: ${LOG}"
