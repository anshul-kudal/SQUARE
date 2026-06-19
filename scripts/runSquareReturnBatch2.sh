#!/usr/bin/env bash
# Batch R2 — 24 multi-line / partial-line refund TCs (48 interactions).
#
# Usage:
#   ./scripts/runSquareReturnBatch2.sh
#   TAG=batchr2 ./scripts/runSquareReturnBatch2.sh
set -euo pipefail
cd "$(dirname "$0")/.."

export SUITE="Square_Suite/Return_Import"
export TAG="${TAG:-batchr2}"
export NODE_ENV="${NODE_ENV:-dev}"
export SETUP="${SETUP:-E2E_Square}"
export PBI="${PBI:-SQNS}"
export SQUARE_FLOW_PROFILE="${SQUARE_FLOW_PROFILE:-quick}"
export SQUARE_QUICK="${SQUARE_QUICK:-1}"
export TEST_MAX_RETRIES="${TEST_MAX_RETRIES:-3}"
# Scheduled-pull mode (same as smoke/R1): refund flow's HTTPExport pulls the refund.
export SQUARE_REFUND_SKIP_INDEX="${SQUARE_REFUND_SKIP_INDEX:-true}"

LOG="/tmp/square_return_batch2.log"

echo "=============================================="
echo " Square Return/Refund — Batch R2 (24 TCs)"
echo " SUITE=${SUITE}  TAG=${TAG}"
echo " Log=${LOG}"
echo "=============================================="

if [ "${SQUARE_REFUND_SKIP_INDEX}" != "true" ]; then
  env NODE_ENV="${NODE_ENV}" SETUP="${SETUP}" PBI="${PBI}" node scripts/squareIoExportPreflight.js
fi

node scripts/generateSquareReturnBatch2.js

rm -f ".test-state/${TAG}.json" 2>/dev/null || true

env NODE_ENV="${NODE_ENV}" SETUP="${SETUP}" PBI="${PBI}" SUITE="${SUITE}" TAG="${TAG}" \
  SQUARE_FLOW_PROFILE="${SQUARE_FLOW_PROFILE}" SQUARE_QUICK="${SQUARE_QUICK}" \
  TEST_MAX_RETRIES="${TEST_MAX_RETRIES}" SQUARE_REFUND_SKIP_INDEX="${SQUARE_REFUND_SKIP_INDEX}" \
  npx jest --config ./jest.config.js --runInBand --forceExit 2>&1 | tee "$LOG"

echo ""
echo "Done. Log: ${LOG}"
