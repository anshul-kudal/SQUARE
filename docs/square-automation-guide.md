# Square → NetSuite Order Import — E2E Automation Guide

**Repository:** [SQUARE](https://github.com/anshul-kudal/SQUARE) · **Monorepo:** rest-api-ia · **Profile:** E2E_Square · **Framework:** @celigo/rest-api-ia-automation

> Import this file into Microsoft Word or Google Docs for a printable team document.

---

## 1. Executive Summary — Automation Achievement

| Metric | Value |
|--------|------:|
| Total TCs automated | 125 |
| On-disk JSON + payloads | 125 |
| Full suite result | 117/125 passed (94%) · 2.4h |
| Batches | B1–B9 + SC1 |
| GitHub repo | https://github.com/anshul-kudal/SQUARE |

**One-liner:** 125 automated E2E tests create real Square orders, run Integrator.io flows, and validate NetSuite cash sales — ready for every release.

### Latest full-suite run

| Passed | Failed | Pass rate | Duration |
|-------:|-------:|----------:|----------|
| 117 | 8 | 94% | 2.4h |

### Automation coverage

| Metric | Value |
|--------|------:|
| Total TCs (planned) | 125 |
| Unique Zephyr IDs | 120 |
| Picked & automated | 125 |
| Remaining to automate | 0 |
| Remaining to stabilize (full suite) | 8 |

### Next steps

1. All 125 TCs picked up and automated — JSON testcases + payload folders on disk (100%)
2. Stabilize 8 TCs failing in latest full-suite run (NS timing / suite-fatigue timeouts)
3. Live demo: run 3 sample TCs in ~5 min (Batch1SingleLine → Batch1LineDisc25 → Batch7GiftPartialTip)
4. Per-batch regression before hotfixes (~15–45 min per batch via TAG=batchN)
5. Team onboarding: clone https://github.com/anshul-kudal/SQUARE

**Live demo:** [square-demo-guide.html](square-demo-guide.html)

---

## 2. What We Validate

- **Square:** Real orders (tax, discounts, tips, modifiers, gift cards, lot/serial)
- **Integrator.io:** Settings, flow run, job completion, payment mapping
- **NetSuite:** Cash sale line items, eTail fields, all variances = 0

---

## 3. Project Structure

```
SQUARE/ (github.com/anshul-kudal/SQUARE)
├── testcases/Square_Suite/     # 125 TC JSON files
├── test-data/Square_Suite/     # Per-TC payload folders
├── helpers/squareDataCreation.js
├── scripts/runSquareOrderSuite.sh
└── report/                     # HTML reports
```

---

## 4. Batch Status

| Metric | Value |
|--------|------:|
| Planned test cases | 125 |
| On-disk testcase JSON | 125 |
| Unique automatable Zephyr IDs | 121 |
| Tracked log runs | 30 |

### Batch status

| Batch | TCs | Theme | Status |
|-------|----:|-------|--------|
| 1 | 10 | Tax, discount, tip, rounding | STABLE |
| 2 | 11 | Multi-line, cart/line discounts, tips | STABLE |
| 3 | 12 | On-demand sync, default customer, tips | STABLE |
| 4 | 9 | Modifiers, new customer, qty | STABLE |
| 5 | 14 | Payment mapping & SKU paths | STABLE |
| 6 | 18 | Modifiers & on-demand edge cases | STABLE |
| 7 | 8 | Gift card / partial payments | STABLE |
| 8 | 25 | Lot / serial / inventory | STABLE |
| 9 | 17 | Customer, tax, IO settings | STABLE |
| SC1 | 1 | PRE-25603 core scenario | DONE |

**Done:** All 125 TCs on disk. Full suite run: 117/125 passed (94%) · 2.4h. Individual batches 1–9 verified stable.

---

## 5. Expected Execution Times (per batch)

| Batch | TCs | Typical duration | Per-TC avg |
|-------|----:|------------------|------------|
| 1 | 10 | ~20–30 min | ~2 min |
| 2 | 11 | ~20–25 min | ~2 min |
| 3 | 12 | ~25–35 min | ~2 min |
| 4 | 9 | ~15–20 min | ~2 min |
| 5 | 14 | ~25–35 min | ~2 min |
| 6 | 18 | ~20–25 min | ~60–75 s |
| 7 | 8 | ~13 min | ~90 s |
| 8 | 25 | ~30–45 min | ~60–120 s |
| 9 | 17 | ~25–35 min | ~60–90 s |
| SC1 | 1 | ~2 min | ~2 min |
| **Full suite** | **125** | **~8 h** | ~4 min avg |

---

## 6. How to Run

```bash
cd SQUARE   # or rest-api-ia

# Single batch
env NODE_ENV=dev SETUP=E2E_Square SUITE=Square_Suite TAG=batch8 npm run jest

# Full suite (125 TCs)
./scripts/runSquareOrderSuite.sh

# Regenerate docs + report
node scripts/generateSquareTeamDocs.js
node scripts/generateSquareHtmlReport.js /tmp/square_fullsuite_run.log /tmp/square_fullsuite_resume*.log
```

---

## 7. Architecture

Three apps orchestrated by Jest + Celigo REST API IA framework:

- **Jest Runner** → globalSetup.js, global.spec.ts, squareDataCreation.js
- **Integrator.io** → settings, flow run, job polling
- **Square API** → order creation + payment at runtime
- **NetSuite** → cash sale validation via saved search proxy

When `PBI=SQNS`, Square handlers register into `shopifyDataCreationHandlers` (framework hook name).

---

## 8. Lifecycle

1. Run generator script → writes testcase JSON + 6 payload files per TC
2. `npm run jest TAG=batchN` → globalSetup loads suite
3. Each TC: pre_request (settings + create order + run flow) → NS validation
4. Pass/fail → HTML report + log

---

## 9. File structure

| Path | Purpose |
|------|---------|
| testcases/Square_Suite/Order_Import/Batch1..9_*.json | Jest testcase definitions |
| test-data/Square_Suite/Order_Import/Batch{N}/PRET{id}/ | Per-TC payloads (6 files) |
| helpers/squareOrderScenarios.js | Order shape templates |
| helpers/squareDataCreation.js | Square API + stability handlers |
| helpers/squareBatchGenerator.js | Shared generator (batches 2–9) |
| scripts/generateSquareBatch*.js | Regenerate JSON + payloads |
| env/E2E_Square.env | Environment profile |
| config/squareNsSavedSearchPatch.js | NS column fix for Square |

---

## 10. Payload files (per TC)

| File | Purpose |
|------|---------|
| _flowStatusJSON.json | Enable/disable IO flows |
| _updateSettings0.json | Settings before order |
| _createOrder.json | orderKeyPrefix → handler |
| _updateSettings1.json | On-demand sync setting |
| _flow_response1.json | Expected flow job stats |
| _expectedResponse1.json | Expected NS cash sale |

Path: `test-data/Square_Suite/Order_Import/Batch{N}/PRET{zephyrNum}/`

---

## 11. Key source files

- **squareOrderScenarios.js** — order shapes (SINGLE_LINE_BASE, SERIAL_MULTI, etc.)
- **squareDataCreation.js** — handlers + stability (409 retry, idle wait)
- **squareBatchGenerator.js** — buildInteraction, buildExpected, generateBatch
- **generateSquareBatches5to9.js** — main backlog (82 TCs)
- **globalSetup.js** — PBI=SQNS wiring

---

## 12. Suites & batches (125 TCs on disk)

- **Suite:** Square_Suite
- **Sub-suites:** Order_Import (Batches 1–9) + PRE25603_SC1
- **Total planned:** 124 Order Import + 1 SC1 = **125 interactions**
- **Filter:** TAG=batch8, TAG='batch5|batch6|batch7'

---

## 13. TC execution flow (11 pre_request steps)

1. GET integration ID  
2. GET flow ID  
3. PUT flow status  
4. PUT settings0 (test-specific IO settings)  
5. POST create Square order (dataCreationMethod handler)  
6. PUT settings1 (on-demand order sync)  
7. Static delay (Batch 8: 30s)  
8. Wait for flow idle  
9. Run flow with 409 retry  
10. Poll jobs/latest until completed  
11. Post-flow idle wait  
12. **Validation:** verifyCashsaleDataFromNetsuite (NS proxy)

---

## 14. Environment

```bash
env NODE_ENV=dev SETUP=E2E_Square SUITE=Square_Suite TAG=batch8 npm run jest
```

| Variable | Role |
|----------|------|
| NODE_ENV=dev | Local env file |
| SETUP=E2E_Square | Square profile |
| SUITE=Square_Suite | Testcase folder |
| TAG | Batch filter |
| PBI=SQNS | Square handler mode |

---

## 15. Example TC — PRE-T16526

- **Test:** Batch8SerialMulti  
- **Handler:** createSquareOrderSerialMulti  
- **Scenario:** SERIAL_MULTI (qty 2 serialized)  
- **Expected:** Quantity 2, Rate 19.40, all variances 0  

Files under: `test-data/Square_Suite/Order_Import/Batch8/PRET16526/`

---

## 16. Error handling

- Flow 409 retry (6×, 10s)  
- Flow idle waits (600s / 120s post)  
- TEST_MAX_RETRIES=3  
- Settings isolation per TC  
- flowMaxWait in **minutes** (Batch 8: 10 min)

---

## 17. Used vs not used

**Used:** rest-api-ia-automation framework, E2E_Square.env, Square helpers, TAG filtering, NS saved search validation.

**Not used:** Other Shopify suites, taxSetupCheck (PBI=SQNS), Shopify catalog creation, Report Portal remote (local only).

---

## 18. Demo Q&A

- **Payload location:** test-data/Square_Suite/Order_Import/Batch{N}/PRETxxxxx/
- **Order creation:** Runtime via squareDataCreation.js handler, not static JSON
- **Run one batch:** env NODE_ENV=dev SETUP=E2E_Square SUITE=Square_Suite TAG=batch5 npm run jest
- **Pass/fail:** NS response vs _expectedResponse1.json

---

## 12. Reports

- `report/index.html` — Jest report  
- `report/square_run_history_dashboard.html` — Run history  
- `node scripts/generateSquareHtmlReport.js <log>` — Custom report  

---

*Generated: 2026-06-03T07:56:59.813Z*
