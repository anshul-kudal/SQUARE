# Square → NetSuite Order Import — E2E Automation Guide

**Repository:** rest-api-ia · **Profile:** E2E_Square · **Framework:** @celigo/rest-api-ia-automation

> Import this file into Microsoft Word or Google Docs for a printable team document.

---

## 1. Status — Done vs Remaining

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
| 8 | 25 | Lot / serial / inventory | IN PROGRESS |
| 9 | 17 | Customer, tax, IO settings | NOT STARTED |
| SC1 | 1 | PRE-25603 core scenario | DONE |

**Done:** All 125 TCs on disk with payload folders. Batches 5–7 stable (14+18+8 = 40 TCs verified).

**In progress:** Batch 8 (25 TCs, lot/serial/inventory).

**Remaining:** Finish Batch 8 + run Batch 9 (17 TCs) + optional full regression.

---

## 2. Architecture

Three apps orchestrated by Jest + Celigo REST API IA framework:

- **Jest Runner** → globalSetup.js, global.spec.ts, squareDataCreation.js
- **Integrator.io** → settings, flow run, job polling
- **Square API** → order creation + payment at runtime
- **NetSuite** → cash sale validation via saved search proxy

When `PBI=SQNS`, Square handlers register into `shopifyDataCreationHandlers` (framework hook name).

---

## 3. Lifecycle

1. Run generator script → writes testcase JSON + 6 payload files per TC
2. `npm run jest TAG=batchN` → globalSetup loads suite
3. Each TC: pre_request (settings + create order + run flow) → NS validation
4. Pass/fail → HTML report + log

---

## 4. File structure

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

## 5. Payload files (per TC)

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

## 6. Key source files

- **squareOrderScenarios.js** — order shapes (SINGLE_LINE_BASE, SERIAL_MULTI, etc.)
- **squareDataCreation.js** — handlers + stability (409 retry, idle wait)
- **squareBatchGenerator.js** — buildInteraction, buildExpected, generateBatch
- **generateSquareBatches5to9.js** — main backlog (82 TCs)
- **globalSetup.js** — PBI=SQNS wiring

---

## 7. Suites & batches (125 TCs on disk)

- **Suite:** Square_Suite
- **Sub-suites:** Order_Import (Batches 1–9) + PRE25603_SC1
- **Total planned:** 124 Order Import + 1 SC1 = **125 interactions**
- **Filter:** TAG=batch8, TAG='batch5|batch6|batch7'

---

## 5. TC execution flow (11 pre_request steps)

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

## 6. Environment

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

## 7. Validations

**Square:** Order lines, payments, catalog IDs, stored order ID.

**Integrator.io:** Flow status, settings, job completion, numSuccess/numError.

**NetSuite:** Cash sale line items, eTail order ID, zero variance fields.

---

## 8. Example TC — PRE-T16526

- **Test:** Batch8SerialMulti  
- **Handler:** createSquareOrderSerialMulti  
- **Scenario:** SERIAL_MULTI (qty 2 serialized)  
- **Expected:** Quantity 2, Rate 19.40, all variances 0  

Files under: `test-data/Square_Suite/Order_Import/Batch8/PRET16526/`

---

## 9. Error handling

- Flow 409 retry (6×, 10s)  
- Flow idle waits (600s / 120s post)  
- TEST_MAX_RETRIES=3  
- Settings isolation per TC  
- flowMaxWait in **minutes** (Batch 8: 10 min)

---

## 10. Used vs not used

**Used:** rest-api-ia-automation framework, E2E_Square.env, Square helpers, TAG filtering, NS saved search validation.

**Not used:** Other Shopify suites, taxSetupCheck (PBI=SQNS), Shopify catalog creation, Report Portal remote (local only).

---

## 11. Demo Q&A

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

*Generated: 2026-05-28T21:00:14.032Z*
