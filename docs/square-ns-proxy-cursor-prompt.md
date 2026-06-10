# Square E2E — NetSuite Proxy Setup (Cursor one-shot prompt)

Copy everything inside the fenced block below into Cursor as a **single message**. Replace all `<<CHANGE_ME_*>>` placeholders for your NS / IO account before sending.

---

```
You are working in the rest-api-ia repo (Celigo REST API IA automation framework + @celigo/rest-api-ia-automation).

GOAL: Wire NetSuite (NS) proxy validation for Square–NetSuite E2E suites exactly like the working SQNS setup. Implement, verify, and fix until NS proxy cash-sale lookup works. Do not ask follow-up questions — use the values below and repo conventions.

═══════════════════════════════════════════════════════════════════════════════
A. HOW NS PROXY WORKS IN THIS REPO (architecture)
═══════════════════════════════════════════════════════════════════════════════

1. Testcase final step is NOT a real HTTP body — it triggers NS validation:
   - request.method: POST
   - request.path: /connections/process.env[CONNECTIONS.NETSUITE]/proxy
   - response.dataValidationMethod: verifyCashsaleDataFromNetsuite | verifyCashRefundDataFromNetsuite
   - response.uniqueValue: Square order id (plain or {{PRETxxxxsquareOrderId}})
   - response.body: path to *_expectedResponse1.json

2. Framework flow (@celigo/rest-api-ia-automation):
   - netsuite.init() sets exportBaseURL = `/connections/${CONNECTIONS.NETSUITE}/proxy`
   - makeNSCall() → nsApiRequest(POST, proxy, { requests: [savedsearch] })
   - HTTP headers on proxy POST:
     - Authorization: Bearer <Integrator.token decoded>
     - Integrator-Method: POST
     - Integrator-NetSuite-ScriptId: customscript_celigo_nsconnectorutil (default)
     - Integrator-NetSuite-DeployId: customdeploy_celigo_nsconnectorutil (default)
   - Cash sale lookup: getCashSaleFromSavedSearch(orderId)
     - recordType: cashsale
     - filter adds: custbody_celigo_etail_order_id IS <orderId>
     - base filters: mainline=F, shipping=F, taxline=F, cogs=F
   - Cash refund lookup: getNetSuiteDataFromSavedSearch(orderId, cashrefund, CASHREFUND_COLUMNS, CASHREFUND_FILTERS)
     - filter adds: custbody_celigo_etail_order_id IS <orderId>
   - fetchNSDataWithRetry() retries empty results using NS_EMPTY_RESULT_RETRIES × NS_EMPTY_RESULT_DELAY_MS

3. Square-specific patch (REQUIRED for non-Shopify NS accounts):
   - File: config/squareNsSavedSearchPatch.js
   - Strips Shopify-only saved-search columns that break Square NS accounts:
     custcol_location_id, custcolcust_delivery_method_id
   - Patches: SALESORDER_COLUMNS, SALESORDER_COLUMNS_INV_STATUS_ENABLED, CASHSALE_COLUMNS
   - Must run in __tests__/globalSetup.js when PBI=SQNS (before any NS validation)

4. Square skips Shopify taxSetupCheck in globalSetup when PBI=SQNS.

═══════════════════════════════════════════════════════════════════════════════
B. REFERENCE VALUES (our working IAQA Square setup — replace for your NS)
═══════════════════════════════════════════════════════════════════════════════

ENV FILE: env/E2E_Square.env (loaded when NODE_ENV=dev SETUP=E2E_Square)

── Integrator.io API ──
PBI=SQNS
NODE_ENV=dev
SETUP=E2E_Square
ENVIRONMENT=IAQA
BASE_URL=https://iaqa.staging.integrator.io
API=https://api.iaqa.staging.integrator.io
API_V1=https://api.iaqa.staging.integrator.io/v1
Integrator.baseurl=https://api.iaqa.staging.integrator.io/
Integrator.token=<<CHANGE_ME_base64_Bearer_token>>   # base64("Bearer <api_token>")
# Token MUST include: Connection proxy (for NS /proxy POST). For refunds also: connection export/import.

── Connections (IO connection _id values) ──
CONNECTIONS.NETSUITE=<<CHANGE_ME_ns_connection_id>>          # ref: 683600c3b930db739ebebad8
CONNECTIONS.SQUARE=<<CHANGE_ME_square_connection_id>>      # ref: 68c9211b72d1a9eb1f7179ce
CONNECTIONS.SQUARE_INTEGRATION_ID=<<CHANGE_ME_integration>> # ref: 68c9211aecfe7dba81340bc3
CONNECTIONS.SQUARE_NS_INTEGRATION=<<CHANGE_ME_parent_int>>  # ref: 68c9211a72d1a9eb1f7179af
CONNECTIONS.NS_ACCOUNT_IDENTIFIER=<<CHANGE_ME_ns_account>>  # ref: TSTDRV1463095
CONNECTIONS.IO_CONNECTOR_IDENTIFIER=Square - NetSuite

── Store / channel (framework uses store1 / SHOPIFY_PRIMARY_STORE_DATA slot) ──
SHOPIFY_PRIMARY_STORE_DATA.STORE_NAME=<<CHANGE_ME_store_name>>   # ref: TestAccount-1 anshul
SHOPIFY_PRIMARY_STORE_DATA.STORE_ID=<<CHANGE_ME_child_account>> # ref: MLREE0FX16AP3
SQUARE_PRIMARY_STORE_DATA.STORE_ID=<<CHANGE_ME_child_account>>
SQUARE_PRIMARY_STORE_DATA.STORE_NAME=<<CHANGE_ME_store_name>>
SQUARE_PRIMARY_STORE_DATA.LOCATION_ID=<<CHANGE_ME_square_location>> # ref: LNGQJ30705K9C

AUT.SH=Square
AUT.NS=Netsuite
CURRENCY.NETSUITE=USD
CURRENCY.SQUARE=USD

── NetSuite master data (must exist in target NS account) ──
DEFAULT_CUSTOMER.ID=<<CHANGE_ME_customer_internal_id>>   # ref: 386525
DEFAULT_CUSTOMER.EMAIL=<<CHANGE_ME_email>>
DEFAULT_CUSTOMER.FIRST_NAME=<<CHANGE_ME_first>>
DEFAULT_CUSTOMER.LAST_NAME=<<CHANGE_ME_last>>

DEFAULTS.PRODUCTS.0.SKU=<<CHANGE_ME_sku1>>               # ref: Celigo Steel Water Bottle
DEFAULTS.PRODUCTS.0.PRICE=<<CHANGE_ME_price1>>           # ref: 19.40
DEFAULTS.PRODUCTS.1.SKU=<<CHANGE_ME_sku2>>               # ref: Test product
DEFAULTS.PRODUCTS.1.PRICE=<<CHANGE_ME_price2>>         # ref: 19.40

DEFAULT_DISCOUNT.DISCOUNTS.0.NAME=DIS00000                 # order-level discount item in NS

NS_DEFAULT.LOCATION1=<<CHANGE_ME_ns_location_name>>      # ref: Location1 — REQUIRED for refund validation; add if missing!
NS_LOCATION_ID.ID=<<CHANGE_ME_location_internal_id>>      # ref: 6 — used in IO settings if needed

NS_TAX_PREFERENCE_DETAILS.DEPLOY_ID=customdeploy1          # only if running taxSetupCheck (skipped for SQNS)
NS_TAX_PREFERENCE_DETAILS.SCRIPT_ID=customscript700

── NS proxy timing / retries ──
NS_SETTLE_DELAY_MS=10000
NS_EMPTY_RESULT_RETRIES=5
NS_EMPTY_RESULT_DELAY_MS=15000
NS_PROXY_TIMEOUT_MS=180000                                 # optional; framework default 180000

── Reset files (Square-specific) ──
RESET_FLOW_STATUS_PATH=/config/resetFlowStatus_Square.json
RESET_SETTINGS_PATH=/config/resetSettings_Square.json
REFRESH_MAP=[]                                             # required for IO labelMap()

── Square flows ──
SQUARE_FLOWS.ORDER_CASHSALE_ID=<<CHANGE_ME_order_flow_id>>
SQUARE_FLOWS.REFUND_CASHREFUND_ID=<<CHANGE_ME_refund_flow_id>>

═══════════════════════════════════════════════════════════════════════════════
C. FILES THAT MUST EXIST / BE CORRECT
═══════════════════════════════════════════════════════════════════════════════

1. env/E2E_Square.env — all vars in section B (create or update)

2. config/squareNsSavedSearchPatch.js — strip Shopify columns (copy from repo if missing)

3. __tests__/globalSetup.js — when PBI===SQNS:
   - skip taxSetupCheck
   - applySquareNsSavedSearchPatch()
   - register squareDataCreationHandlers

4. __tests__/global.spec.ts — when PBI===SQNS use:
   - resetFlowStatus_Square.json
   - resetSettings_Square.json

5. jest.config.js — setupFiles includes __tests__/globalSetup.js (not framework default only)
   - preserve process.env.PBI from env (do not hardcode SHNS)

6. config/resetFlowStatus_Square.json
7. config/resetSettings_Square.json — clears On-demand order/refund sync

8. scripts/fetchSquareNSCashSale.js — manual NS debug tool

9. Test generators wire NS validation:
   - helpers/squareBatchGenerator.js → verifyCashsaleDataFromNetsuite
   - helpers/squareReturnBatchGenerator.js → verifyCashsale + verifyCashRefund

═══════════════════════════════════════════════════════════════════════════════
D. TESTCASE JSON PATTERN (generators produce this)
═══════════════════════════════════════════════════════════════════════════════

Order interaction validation block:
{
  "request": { "method": "POST", "path": "/connections/process.env[CONNECTIONS.NETSUITE]/proxy" },
  "response": {
    "status": 200,
    "time": 10000,
    "dataValidationMethod": "verifyCashsaleDataFromNetsuite",
    "body": "/test-data/Square_Suite/.../BatchXxxOrder_expectedResponse1.json",
    "uniqueValue": "{{PRETxxxxsquareOrderId}}",
    "secondaryValue": "false"
  }
}

Cash sale expected JSON template (BatchR0 example):
{
  "cashSale_line_items": [
    { "Item": "process.env[DEFAULTS.PRODUCTS.0.SKU]", "Quantity": "1", "Item Rate": "19.40" }
  ],
  "eTail Order Id": "{{PRET16650squareOrderId}}",
  "eTail Channel": "process.env[AUT.SH]",
  "eTail Order Total Variance": "0",
  "eTail Discount Total Variance": "0",
  "eTail Tax Total Variance": "0",
  "eTail Ship Total Variance": "0",
  "Currency": "process.env[CURRENCY.NETSUITE]"
}

Cash refund expected JSON template:
{
  "Amount (Transaction Total)": "-19.40",
  "etail_refund_line_items": [
    { "Item": "process.env[DEFAULTS.PRODUCTS.0.SKU]", "Quantity": "-1", "Amount (Foreign Currency)": "-19.40" }
  ],
  "eTail Refund Exported": "T",
  "eTail Order Id": "{{PRET16650squareOrderId}}",
  "eTail Channel": "process.env[AUT.SH]",
  "Payment Method": "Cash",
  "Location": "process.env[NS_DEFAULT.LOCATION1]",
  "eTail Order Total Variance": "0"
}

IMPORTANT lookup key: uniqueValue is the **plain Square order id** (e.g. 5V7oNYlwyrgpNINihNnRcEVCeR9YY), NOT location-prefixed on-demand sync key.

═══════════════════════════════════════════════════════════════════════════════
E. NETSUITE ACCOUNT PREREQUISITES (verify in NS UI)
═══════════════════════════════════════════════════════════════════════════════

1. Celigo Square–NetSuite IA bundle installed on target account
2. Custom body fields populated by integration on cash sale / cash refund:
   - custbody_celigo_etail_order_id  → Square order id
   - custbody_celigo_etail_channel   → "Square" (matches AUT.SH)
   - Variance fields (Order/Discount/Tax/Ship Total Variance) → 0 for clean TCs
3. Items in NS match DEFAULTS.PRODUCTS.*.SKU (by name/SKU mapping in Square connector)
4. Default customer (DEFAULT_CUSTOMER.ID) exists
5. Discount item DIS00000 exists if discount TCs run
6. NS connection in IO:
   - Type: NetSuite
   - Linked to same account as CONNECTIONS.NS_ACCOUNT_IDENTIFIER
   - Token/auth valid; proxy enabled
7. IO NetSuite connection _id matches CONNECTIONS.NETSUITE in env

═══════════════════════════════════════════════════════════════════════════════
F. IMPLEMENTATION TASKS (do all, in order)
═══════════════════════════════════════════════════════════════════════════════

TASK 1 — Create/update env/E2E_Square.env with section B values (all CHANGE_ME filled).

TASK 2 — Ensure config/squareNsSavedSearchPatch.js exists and globalSetup applies it for PBI=SQNS.

TASK 3 — Ensure jest.config.js uses __tests__/globalSetup.js and preserves PBI from env.

TASK 4 — Add missing NS_DEFAULT.LOCATION1 to env if refund validation will run (match NS location name on cash refund records).

TASK 5 — Create scripts/nsProxyPreflight.js that:
   - loads env via getDataFromNodeProcess + config.initialize()
   - calls applySquareNsSavedSearchPatch() + netsuite.init()
   - POSTs a minimal savedsearch to /connections/{NETSUITE}/proxy with a known eTail order id (accept CLI arg)
   - prints clear PASS/FAIL (401 = bad token; empty results = order not in NS yet; column errors = patch missing)

TASK 6 — Run preflight after a known cash sale exists:
   NODE_ENV=dev SETUP=E2E_Square node scripts/fetchSquareNSCashSale.js <squareOrderId>
   If fails: diagnose token (401), column errors (apply patch), empty results (flow didn't create CS or wrong order id).

TASK 7 — Run one smoke order TC:
   NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite/Return_Import TAG=batchr0smoke01 npx jest --config ./jest.config.js --runInBand
   Order interaction must PASS verifyCashsaleDataFromNetsuite.

TASK 8 — If saved-search column errors mention custcol_location_id or custcolcust_delivery_method_id:
   confirm squareNsSavedSearchPatch ran (log: "Applied Square NS saved-search column patch").

TASK 9 — If "Unable to fetch data from NS for Etail Order ID":
   - increase NS_EMPTY_RESULT_RETRIES / NS_EMPTY_RESULT_DELAY_MS
   - increase nsSettleDelayMs in flow (post-flow delay before NS validation)
   - confirm Square order flow completed and custbody_celigo_etail_order_id is set in NS

TASK 10 — Document final working CONNECTIONS.NETSUITE id and NS_DEFAULT.LOCATION1 in env file comments.

═══════════════════════════════════════════════════════════════════════════════
G. VERIFICATION COMMANDS
═══════════════════════════════════════════════════════════════════════════════

# Encode API token
node -e "console.log(Buffer.from('Bearer YOUR_TOKEN').toString('base64'))"

# Load env + fetch cash sale by Square order id
NODE_ENV=dev SETUP=E2E_Square node scripts/fetchSquareNSCashSale.js <squareOrderId>

# Single smoke TC (order + refund)
NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite/Return_Import TAG=batchr0smoke01 npx jest --config ./jest.config.js --runInBand --forceExit

# Full order suite
./scripts/runSquareOrderSuite.sh

═══════════════════════════════════════════════════════════════════════════════
H. COMMON FAILURES → FIXES
═══════════════════════════════════════════════════════════════════════════════

| Symptom | Cause | Fix |
|--------|-------|-----|
| 401 access_restricted on /proxy | Integrator.token lacks Connection proxy | Regenerate IO API token with proxy permission; update Integrator.token base64 |
| Column custcol_location_id invalid | Shopify columns in saved search | Apply squareNsSavedSearchPatch in globalSetup |
| No NS results after N retries | Cash sale not created or settle too fast | Run order flow first; bump NS_EMPTY_RESULT_* and nsSettleDelayMs |
| Item/Rate mismatch | SKU or discount mapping wrong | Align DEFAULTS.PRODUCTS SKUs with NS items; tune expectedResponse JSON |
| Location mismatch on refund | NS_DEFAULT.LOCATION1 wrong/missing | Set to exact NS location name on cash refund |
| taxSetupCheck fails | Wrong SUITE for Square | Use PBI=SQNS (skips tax check) |
| wrong integration reset | SHNS reset files | Use resetFlowStatus_Square.json / resetSettings_Square.json in global.spec |

═══════════════════════════════════════════════════════════════════════════════
I. DO NOT
═══════════════════════════════════════════════════════════════════════════════

- Do not use Shopify env (dev.env CONNECTIONS.NETSUITE) for Square — use env/E2E_Square.env only in dev
- Do not hardcode connection IDs in testcase JSON — use process.env[CONNECTIONS.NETSUITE]
- Do not skip squareNsSavedSearchPatch for Square NS test accounts
- Do not use location-prefixed on-demand sync key as uniqueValue for NS proxy lookup

Execute all tasks. Report: env vars set, preflight result, smoke TC result, and any code changes made.
```
