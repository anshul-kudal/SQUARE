# AGENTS.md — SQUARE Test Automation

> Single entry point for any developer or AI agent working in this repo.
> Read this first. It links to deep docs; follow links only when you need detail.

## 1. What this project is

Standalone REST API test automation for **Square POS → Integrator.io (IO) → NetSuite (NS)**.

- **Order Import**: Square order + cash payment → IO flow → NS **Cash Sale**, validated via NS proxy.
- **Return / Refund Import**: Square refund → IO flow → NS **Cash Refund**, validated via NS proxy.
- **~330 automated TCs**: 125 Order (Batches 1–9 + SC1) + 205 Return/Refund (Batches R0–R11). Order = 117 green / 8 to stabilize; Refund = all green per-batch (consolidated stabilization pending).
- Results can be published to **Zephyr Scale** (test cycle + executions + proof).

**Stack**: Node 22.11.0, Jest (ts-jest), `@celigo/rest-api-ia-automation`. Product identifier **`PBI=SQNS`**, setup **`SETUP=E2E_Square`**, suite **`SUITE=Square_Suite`**.

### Flow pipeline (every TC)
```
create Square order/refund (Square API)
  → trigger IO flow (persistSettings / on-demand sync)
  → poll IO flow until idle
  → validate NS record via /connections/{NETSUITE}/proxy (variances must be 0)
```

## 2. Golden rules for agents (always follow)

1. **Never commit secrets.** Real `env/E2E_Square.env` and `env/zephyr.env` are gitignored. Only `*.env.example` is tracked.
2. **Don't invent IDs/credentials.** Connection IDs, tokens, catalog IDs live in `env/E2E_Square.env` (copied from the example).
3. **Every run needs env vars**: `NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite TAG=<filter>`.
4. **Validation passes only when all variances = 0.** Tune `expectedResponse` JSON, never the validator.
5. **Jest may exit 1 even when all tests pass** — caused by a non-blocking `globalTeardown` error. Trust the printed `TEST SUITE SUMMARY`, not just the exit code.
6. **Only commit when asked.** Keep secrets and temp files (`.tmp-cd/`, local clones) out of commits.

## 3. Quick start

```bash
npm install                                  # needs ~/.npmrc auth for @celigo (GitHub Packages)
cp env/E2E_Square.env.example env/E2E_Square.env   # fill in IDs/tokens
cp env/zephyr.env.example env/zephyr.env           # only for Zephyr publishing
env NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite TAG=batch1 npm run jest
```

## 4. Most common commands

| Goal | Command |
|------|---------|
| Run one batch | `env NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite TAG=batch5 npm run jest` |
| Full order suite | `npm run square:full` |
| Demo (1, 1-2, all) | `./scripts/runSquareDemo.sh 1-2` |
| Return suites | `npm run square:return` |
| Publish to Zephyr | `ZEPHYR_PUBLISH=1 ./scripts/runSquareDemo.sh 1-2` |
| HTML report from log | `node scripts/generateSquareHtmlReport.js logs/test-run-*.log` |

## 5. Documentation map (drill down as needed)

| Topic | File |
|-------|------|
| Run / execute / batch tags / resume / reports | [docs/RUNBOOK.md](docs/RUNBOOK.md) |
| Write / add a new test case | [docs/WRITING-TESTCASES.md](docs/WRITING-TESTCASES.md) |
| NS / Square / IO connections + env vars | [docs/CONNECTIONS.md](docs/CONNECTIONS.md) |
| NS proxy + saved-search patch + validation rules | [docs/PROXY-AND-VALIDATION.md](docs/PROXY-AND-VALIDATION.md) |
| Zephyr audit / preview / publish | [docs/ZEPHYR.md](docs/ZEPHYR.md) |
| Known issues & fixes | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Architecture deep dive | [docs/square-automation-guide.md](docs/square-automation-guide.md) |

## 6. Skills (invokable workflows)

- `.cursor/skills/square-run-suite` — run batches/demo and generate reports.
- `.cursor/skills/square-write-testcase` — author a new TC (JSON + payloads + scenario).
- `.cursor/skills/square-zephyr-publish` — publish a run to a Zephyr test cycle.

## 7. Project structure

```
SQUARE/
├── AGENTS.md                   # this file
├── .cursor/rules/              # always-apply project rules
├── .cursor/skills/             # invokable workflows
├── testcases/Square_Suite/     # batch JSON: Order_Import/, Return_Import/, PRE25603_SC1.json
├── test-data/Square_Suite/     # per-TC payloads + expected responses
├── helpers/                    # squareDataCreation, scenarios, batch generators, squareDemoConfig
├── scripts/                    # runners, report + batch generators, publishToZephyr
├── config/                     # reset JSON + squareNsSavedSearchPatch.js
├── __tests__/                  # globalSetup.js + global.spec.ts (Jest driver)
├── env/                        # *.env.example (copy → real, gitignored)
└── docs/                       # deep references
```
