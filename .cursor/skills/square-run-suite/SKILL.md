---
name: square-run-suite
description: Run SQUARE (Square→NetSuite) test batches, the demo runner, or return suites, and generate HTML reports. Use when the user asks to run/execute Square tests, run a batch, run the demo, run returns, the full suite, resume a run, or generate a Square test report.
---

# Run SQUARE suites & generate reports

Read `docs/RUNBOOK.md` for full detail. Quick reference below.

## Required env (every run)
`NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite TAG=<filter>`

## Run
```bash
# One or more batches (tags: batch1..batch9, pre25603sc1, return_smoke, batchr1, batchr2)
env NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite TAG=batch5 npm run jest

# Full order suite (125 TCs)
npm run square:full

# Demo (selection: 1 | 1-2 | all | natural language)
./scripts/runSquareDemo.sh 1-2

# Return / refund suites (run preflight first)
node scripts/squareIoExportPreflight.js
npm run square:return
```

## Publish results to Zephyr (optional)
Prefix the demo runner with the flag:
```bash
ZEPHYR_PUBLISH=1 ./scripts/runSquareDemo.sh 1-2
```

## Reports
```bash
npm run report                                   # opens report/index.html
node scripts/generateSquareHtmlReport.js <log>   # pass/fail from a log
node scripts/generateSquareDemoReport.js <log>   # deep demo report
```

## Notes
- Jest may exit 1 even when all tests pass (non-blocking globalTeardown); trust the
  printed `TEST SUITE SUMMARY`.
- Runs create REAL Square orders + NetSuite records. Use `SQUARE_FLOW_PROFILE=quick` for faster dev runs.
- Resume: `RESUME=<TestKey> ... npm run jest` (state in `.test-state/`).
