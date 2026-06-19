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
# Scheduled-pull mode: skip the on-demand /connections/export pre-index gate and let the
# refund flow's "Get Refunds from Square" HTTPExport pull the refund on run (same as orders).
# The on-demand export needs connection-export permission + a valid export payload; the
# scheduled-pull path needs neither and works with the standard account token.
export SQUARE_REFUND_SKIP_INDEX="${SQUARE_REFUND_SKIP_INDEX:-true}"

LOG="/tmp/square_return_smoke.log"

echo "=============================================="
echo " Square Return/Refund — B0 smoke (10 TCs)"
echo " SUITE=${SUITE}  TAG=${TAG}"
echo " Profile=${SQUARE_FLOW_PROFILE}"
echo " Log=${LOG}"
echo "=============================================="

# The export preflight only matters for the on-demand /connections/export path.
# In scheduled-pull mode (SQUARE_REFUND_SKIP_INDEX=true) the refund flow pulls refunds
# itself, so skip the preflight (it would 401 on connection export and abort under set -e).
if [ "${SQUARE_REFUND_SKIP_INDEX}" != "true" ]; then
  env NODE_ENV="${NODE_ENV}" SETUP="${SETUP}" PBI="${PBI}" node scripts/squareIoExportPreflight.js
fi

node scripts/generateSquareReturnSmoke.js

rm -f ".test-state/${TAG}.json" 2>/dev/null || true

env NODE_ENV="${NODE_ENV}" SETUP="${SETUP}" PBI="${PBI}" SUITE="${SUITE}" TAG="${TAG}" \
  SQUARE_FLOW_PROFILE="${SQUARE_FLOW_PROFILE}" SQUARE_QUICK="${SQUARE_QUICK}" \
  TEST_MAX_RETRIES="${TEST_MAX_RETRIES}" SQUARE_REFUND_SKIP_INDEX="${SQUARE_REFUND_SKIP_INDEX}" \
  npx jest --config ./jest.config.js --runInBand --forceExit 2>&1 | tee "$LOG"

echo ""
echo "Done. Log: ${LOG}"
