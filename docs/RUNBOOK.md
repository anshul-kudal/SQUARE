# RUNBOOK — Running & Executing SQUARE

## Required environment variables (every run)

| Var | Value | Meaning |
|-----|-------|---------|
| `NODE_ENV` | `dev` | Environment profile |
| `SETUP` | `E2E_Square` | Loads `env/E2E_Square.env` |
| `PBI` | `SQNS` | Product = Square→NetSuite (enables Square handlers, skips Shopify tax setup) |
| `SUITE` | `Square_Suite` | Test suite root under `testcases/` |
| `TAG` | e.g. `batch1` | Filters which TCs run (matches the `[tag]` in `test_title`) |

Base command:
```bash
env NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite TAG=<filter> npm run jest
```

## Batch-wise run

| Batch | TAG | TCs | File |
|-------|-----|----:|------|
| 1 | `batch1` | 10 | `testcases/Square_Suite/Order_Import/Batch1_TaxDiscountTip.json` |
| 2 | `batch2` | 11 | `Order_Import/Batch2_OrderImport.json` |
| 3 | `batch3` | 12 | `Order_Import/Batch3_OrderImport.json` |
| 4 | `batch4` | 9 | `Order_Import/Batch4_OrderImport.json` |
| 5 | `batch5` | 14 | `Order_Import/Batch5_OrderImport.json` |
| 6 | `batch6` | 18 | `Order_Import/Batch6_OrderImport.json` |
| 7 | `batch7` | 8 | `Order_Import/Batch7_OrderImport.json` |
| 8 | `batch8` | 25 | `Order_Import/Batch8_OrderImport.json` |
| 9 | `batch9` | 17 | `Order_Import/Batch9_OrderImport.json` |
| SC1 | `pre25603sc1` | 1 | `PRE25603_SC1.json` |

Multiple batches: `TAG='batch1|batch2|batch3'`.

### Return / Refund batches

| Batch | TAG | File |
|-------|-----|------|
| Smoke | `return_smoke` | `Return_Import/BatchR0_ReturnSmoke.json` |
| R1 | `batchr1` | `Return_Import/BatchR1_SingleLineAmount.json` |
| R2 | `batchr2` | `Return_Import/BatchR2_MultiLinePartial.json` |

```bash
npm run square:return                        # all return batches
node scripts/squareIoExportPreflight.js      # MUST pass first (refund indexing)
```
Refunds need the IO token to have **connection export/import** permission, else IO returns `422 not valid Refunds`. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Full suite (125 order TCs)
```bash
npm run square:full
```
Live progress: `report/square_fullsuite_progress.md`. Watch with `node scripts/watchSquareSuiteProgress.js`.

## Demo runner

```bash
./scripts/runSquareDemo.sh 1        # single TC
./scripts/runSquareDemo.sh 1-2      # range
./scripts/runSquareDemo.sh all      # all 5 demo TCs
./scripts/runSquareDemo.sh "run 1st and 2nd"   # natural language
```
5 demo TCs are defined in `helpers/squareDemoConfig.js`. Each run writes `/tmp/square_demo_run.log` + `/tmp/square_demo_manifest.json`, generates `report/square_demo_report_latest.html`, and (with `ZEPHYR_PUBLISH=1`) publishes to Zephyr.

## Speed / stability knobs

| Var | Effect |
|-----|--------|
| `SQUARE_FLOW_PROFILE=quick` | Shorter poll/settle waits (demo/dev) |
| `TEST_MAX_RETRIES=<n>` | Per-interaction retry count (default 3) |
| `NS_SETTLE_DELAY_MS`, `NS_EMPTY_RESULT_RETRIES`, `NS_EMPTY_RESULT_DELAY_MS` | NS read retry tuning |

## Resume interrupted runs
```bash
RESUME=<TestKey> env NODE_ENV=dev SETUP=E2E_Square PBI=SQNS \
  SUITE=Square_Suite TAG='batch1|batch2|...' npm run jest
```
State is stored in `.test-state/{TAG}.json` (gitignored).

## Reports

| Command | Output |
|---------|--------|
| `npm run report` | Opens `report/index.html` (Jest HTML reporter) |
| `node scripts/generateSquareHtmlReport.js <log>` | Pass/fail report from a run log |
| `node scripts/generateSquareDemoReport.js <log>` | Deep demo report (order IDs, validations) |
| `node scripts/generateSquareTeamDocs.js` | Regenerate `docs/square-automation-guide.md` |
