# SQUARE — Square Order Import Test Automation

Standalone REST API test automation for **Square → NetSuite Order Import** on Integrator.io.

125 automated test cases across **9 batches + SC1**, with NetSuite cash sale validation, flow stability (409 retry, idle wait), HTML reports, and batch generators.

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

## Documentation

See [docs/square-automation-guide.md](docs/square-automation-guide.md) for architecture, flow pipeline, stability settings, and batch inventory.

## License

ISC
