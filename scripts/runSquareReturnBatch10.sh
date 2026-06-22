#!/usr/bin/env bash
# Batch R10 — 16 multi-payment / gift card / check refund TCs (32 interactions).
#
# ============================ HIGH RISK — READ scripts/generateSquareReturnBatch10.js ===========================
# R10 refunds CHECK and split CASH/CHECK tenders into the "Square → NetSuite Cash Refund" flow.
# Unlike R0–R9 (cash only) it is UNKNOWN whether (a) Square can refund a CHECK/non-cash leg in
# this account and (b) NS produces a cash refund and what Payment Method it shows. Run R10 FIRST
# among the risky batches and prefer scenario-by-scenario via RESUME, starting with the
# GIFT_CARD_FULL (pure-cash) TCs. Expect FULL-kind split TCs to fail at the Square Refunds API.
#
# Usage:
#   ./scripts/runSquareReturnBatch10.sh
#   TAG=batchr10 RESUME='BatchR10GiftCardFullCashFullRefund:5' ./scripts/runSquareReturnBatch10.sh
set -euo pipefail
cd "$(dirname "$0")/.."

export SUITE="Square_Suite/Return_Import"
export TAG="${TAG:-batchr10}"
export NODE_ENV="${NODE_ENV:-dev}"
export SETUP="${SETUP:-E2E_Square}"
export PBI="${PBI:-SQNS}"
export SQUARE_FLOW_PROFILE="${SQUARE_FLOW_PROFILE:-quick}"
export SQUARE_QUICK="${SQUARE_QUICK:-1}"
export TEST_MAX_RETRIES="${TEST_MAX_RETRIES:-3}"
# Scheduled-pull mode (same as smoke): refund flow's HTTPExport pulls the refund; skip
# the on-demand /connections/export gate that needs connection-export permission.
export SQUARE_REFUND_SKIP_INDEX="${SQUARE_REFUND_SKIP_INDEX:-true}"

LOG="/tmp/square_return_batch10.log"

echo "=============================================="
echo " Square Return/Refund — Batch R10 (16 TCs)"
echo " SUITE=${SUITE}  TAG=${TAG}"
echo " Profile=${SQUARE_FLOW_PROFILE}"
echo " Log=${LOG}"
echo "=============================================="

if [ "${SQUARE_REFUND_SKIP_INDEX}" != "true" ]; then
  env NODE_ENV="${NODE_ENV}" SETUP="${SETUP}" PBI="${PBI}" node scripts/squareIoExportPreflight.js
fi

node scripts/generateSquareReturnBatch10.js

rm -f ".test-state/${TAG}.json" 2>/dev/null || true

env NODE_ENV="${NODE_ENV}" SETUP="${SETUP}" PBI="${PBI}" SUITE="${SUITE}" TAG="${TAG}" \
  SQUARE_FLOW_PROFILE="${SQUARE_FLOW_PROFILE}" SQUARE_QUICK="${SQUARE_QUICK}" \
  TEST_MAX_RETRIES="${TEST_MAX_RETRIES}" SQUARE_REFUND_SKIP_INDEX="${SQUARE_REFUND_SKIP_INDEX}" \
  npx jest --config ./jest.config.js --runInBand --forceExit 2>&1 | tee "$LOG"

echo ""
echo "Done. Log: ${LOG}"
