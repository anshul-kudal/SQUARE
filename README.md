# SQUARE — Square → NetSuite IA Test Automation

Standalone REST API test automation for the **Square → NetSuite Integration App** on Integrator.io, covering both **Order Import** (→ NetSuite Cash Sale) and **Return / Refund Import** (→ NetSuite Cash Refund).

**~330 automated end-to-end test cases**, with NetSuite validation, flow stability (409 retry, idle wait), HTML reports, batch generators, and Zephyr publishing.

## Coverage at a glance

| Track | Automated | Status |
|-------|----------:|--------|
| **Order Import** (Batches 1–9 + SC1) | **125** | 117 green · 8 to stabilize |
| **Return / Refund** (Batches R0–R11) | **205** | All green per-batch · consolidated stabilization pending |
| **Total** | **~330** | — |

> Of the **429 test cases in Zephyr** (157 Order, Customer & Tender · 120 Refund Import · 152 General/UI), the Order + Refund data-path scope is automated. The 152 **General** TCs are UI/install/settings — manual by design. Refund batches are built as permutations (205) that map onto the 120 Zephyr refund cases (key mapping pending).

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

### Full Order suite (125 TCs)

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
├── testcases/Square_Suite/     # Batch JSON — Order_Import (125) + Return_Import (R0–R11, 205)
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

## Return / Refund suites (R0–R11 · 205 scenarios)

Square Return → NetSuite Cash Refund batches. Each scenario is a 2-leg flow: **order leg**
(create Square order → NS Cash Sale) + **refund leg** (create Square refund → NS Cash Refund),
both validated via the NS proxy.

| Batch | TAG | Theme | Scenarios |
|-------|-----|-------|----------:|
| R0 | `return_smoke` | Smoke — single/two-line, full/partial, disc/tip/qty/modifier | 10 |
| R1 | `batchr1` | Full & partial **amount**, single line | 22 |
| R2 | `batchr2` | Multi-line, partial line, multi-qty | 24 |
| R3 | `batchr3` | Line + cart + order discount permutations | 20 |
| R4 | `batchr4` | Tips & tip+discount permutations | 18 |
| R5 | `batchr5` | Tax incl/excl, single & multi-line, multi-tax | 22 |
| R6 | `batchr6` | Modifiers & custom-amount refunds | 16 |
| R7 | `batchr7` | Multi-quantity / unit-level refunds | 18 |
| R8 | `batchr8` | Customer / on-demand / idempotency | 16 |
| R9 | `batchr9` | Lot / serial / inventory detail | 15 |
| R10 | `batchr10` | Multi-payment / gift-card / check | 12 |
| R11 | `batchr11` | Settings / variance / export-flag | 12 |
| | | **Total** | **205** |

```bash
# Run a single refund batch (regenerates fixtures, runs order+refund legs)
./scripts/runSquareReturnBatch7.sh          # e.g. R7
SQUARE_REFUND_SKIP_INDEX=true ./scripts/runSquareReturnSmoke.sh   # R0 smoke

# Run a curated 5-TC cross-section (good for a live demo, ~12 min)
env NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SQUARE_REFUND_SKIP_INDEX=true \
  SUITE=Square_Suite/Return_Import TAG=return_smoke \
  npx jest --config ./jest.config.js --runInBand --forceExit -t "BatchR0Smoke0[12468]"
```

**Refund indexing:** refunds normally require the Integrator.io API token to have
**connection export/import** permission (else IO returns `422 not valid Refunds`). The suites
default to `SQUARE_REFUND_SKIP_INDEX=true`, which relies on the refund flow's scheduled pull
instead of an on-demand export — so no special token permission is needed.

**Known gaps (documented in generators):** multi-tender FULL refunds (R10 — harness refunds only
the CHECK leg), combined line+cart discount per-line allocation (R9 — non-deterministic), and a
few R11 settings/negative-path cases need harness/validator extensions.

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
