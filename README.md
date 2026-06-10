# SQUARE — Square Order Import Test Automation

Standalone REST API test automation for **Square → NetSuite Order Import** on Integrator.io.

125 automated test cases across **9 batches + SC1**, plus Return/Refund suites, with NetSuite cash sale validation, flow stability (409 retry, idle wait), HTML reports, batch generators, and Zephyr publishing.

> **New here? Read [AGENTS.md](AGENTS.md)** — the single entry point for developers and AI agents. It links to deep docs in [docs/](docs/) (runbook, writing test cases, connections, proxy/validation, Zephyr, troubleshooting).

## Prerequisites

- **Node.js 22.11.0** (see `engines` in `package.json`)
- npm access to `@celigo/rest-api-ia-automation` (Celigo registry — configure `.npmrc` if needed)
- IO account with Square + NetSuite connections configured
- Square sandbox/production catalog items matching test scenarios

## Setup

```bash
git clone https://github.com/anshul-kudal/SQUARE.git
cd SQUARE
npm install
cp env/E2E_Square.env.example env/E2E_Square.env
# Edit env/E2E_Square.env with your connection IDs, tokens, catalog IDs
```

## Run commands

All runs use:

```bash
env NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite TAG=<filter> npm run jest
```

### Single batch

| Batch | TAG | TCs |
|-------|-----|----:|
| 1 | `batch1` | 10 |
| 2 | `batch2` | 11 |
| 3 | `batch3` | 12 |
| 4 | `batch4` | 9 |
| 5 | `batch5` | 14 |
| 6 | `batch6` | 18 |
| 7 | `batch7` | 8 |
| 8 | `batch8` | 25 |
| 9 | `batch9` | 17 |
| SC1 | `pre25603sc1` | 1 |

Example:

```bash
env NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite TAG=batch5 npm run jest
```

### Full suite (125 TCs)

```bash
npm run square:full
```

Live progress: `report/square_fullsuite_progress.md`

### Reports

```bash
npm run report                              # Jest HTML report
node scripts/generateSquareHtmlReport.js logs/test-run-*.log
node scripts/generateSquareTeamDocs.js      # Regenerate docs/square-automation-guide.md
```

## Project structure

```
SQUARE/
├── testcases/Square_Suite/     # Batch JSON (125 TCs)
├── test-data/Square_Suite/     # Payloads + expected responses
├── helpers/                    # squareDataCreation, batch generator, scenarios
├── scripts/                    # Runners, report generators, batch generators
├── config/                     # Square reset JSON + NS saved-search patch
├── __tests__/                  # globalSetup.js + global.spec.ts (Jest runner)
├── env/E2E_Square.env.example  # Copy → E2E_Square.env (gitignored)
└── docs/square-automation-guide.md
```

## Regenerate batch test JSON

After changing `helpers/squareBatchGenerator.js` or batch generator scripts:

```bash
export SQUARE_FLOW_PROFILE=quick   # or default
node scripts/generateSquareBatch1.js
node scripts/generateSquareBatch2Batch3.js
node scripts/generateSquareBatch4.js
node scripts/generateSquareBatches5to9.js
```

## Catalog setup (Batch 4+)

```bash
node scripts/discoverSquareCatalog.js
node scripts/setupSquareExtendedCatalog.js
node scripts/setupSquareBatch4Catalog.js
```

## Resume interrupted runs

```bash
RESUME=Batch5PayMapDefault env NODE_ENV=dev SETUP=E2E_Square PBI=SQNS \
  SUITE=Square_Suite TAG='batch1|batch2|...' npm run jest
```

State is saved in `.test-state/{TAG}.json`.

## Return / Refund suites

Square Return → NetSuite Cash Refund batches (order leg + refund leg):

| Batch | TAG | File |
|-------|-----|------|
| Smoke | `return_smoke` | `testcases/Square_Suite/Return_Import/BatchR0_ReturnSmoke.json` |
| R1 | `batchr1` | `testcases/Square_Suite/Return_Import/BatchR1_SingleLineAmount.json` |
| R2 | `batchr2` | `testcases/Square_Suite/Return_Import/BatchR2_MultiLinePartial.json` |

```bash
npm run square:return            # all return batches
node scripts/squareIoExportPreflight.js   # verify IO token can index refunds
```

Refunds require the Integrator.io API token to have **connection export/import**
permission (otherwise IO returns `422 not valid Refunds`). Run the preflight first.

## Publish results to Zephyr Scale

Create a timestamped test cycle in the latest release folder, with one execution per
TC (Pass/Fail), assigned to you, and a comment containing the Square Order ID + NS
Cash Sale ID as proof. See the skill at
[.cursor/skills/square-zephyr-publish/SKILL.md](.cursor/skills/square-zephyr-publish/SKILL.md).

```bash
cp env/zephyr.env.example env/zephyr.env   # fill in token + accountId
ZEPHYR_PUBLISH=1 npm run square:demo -- 1-2   # auto-publish after a demo run
node scripts/publishToZephyr.js /tmp/square_demo_run.log   # publish a past run
```

## Documentation

See [docs/square-automation-guide.md](docs/square-automation-guide.md) for architecture, flow pipeline, stability settings, and batch inventory.

## License

ISC
