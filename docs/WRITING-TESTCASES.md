# WRITING / ADDING A TEST CASE

## Where things live

| Kind | Location |
|------|----------|
| Testcase JSON (batch files) | `testcases/Square_Suite/Order_Import/Batch<N>_*.json`, `Return_Import/*.json` |
| Payloads + expected responses | `test-data/Square_Suite/<Suite>/Batch<N>/<PRETxxxxx>/` |
| Data-creation handlers | `helpers/squareDataCreation.js` |
| Scenario definitions | `helpers/squareOrderScenarios.js`, `helpers/squareReturnScenarios.js` |
| Batch generators | `helpers/squareBatchGenerator.js`, `scripts/generateSquareBatch*.js` |

## Anatomy of a testcase interaction

Each batch file has `testData[].interactions[]`. One interaction = one TC:

```json
{
  "test": "Batch1SingleLine",
  "test_title": "Batch1SingleLine [Batch1][PRE-T16506] - Single line order — baseline cash sale import",
  "pre_request": [
    { "request": { "method": "GET", "path": "/integrations", "filterKey": "name : Square - NetSuite", "store_PRET16506integrationID": "_id" } },
    { "request": { "method": "GET", "path": "/flows", "filterKey": "name : Square Order to NetSuite Cash Sale", "store_PRET16506flowId1": "_id", "getFlowsByIntegrationId": true } },
    { "request": { "method": "PUT", "path": "/integrations/{{PRET16506integrationID}}/settings/persistSettings", "settingsMethod": "updateflowStatusThroughAPI", "payload": ".../PRET16506/Batch1SingleLine_flowStatusJSON.json" } },
    { "request": { "method": "POST", "path": "/connections/process.env[CONNECTIONS.SQUARE]/export", "payload": ".../Batch1SingleLine_createOrder.json", "dataCreationMethod": "createSquareOrderSingleLineBase", "orderKeyPrefix": "PRET16506", "skipThePreRequestValidation": true } }
  ],
  "validation": {
    "dataValidationMethod": "verifyCashsaleDataFromNetsuite",
    "body": ".../PRET16506/Batch1SingleLine_expectedResponse1.json",
    "uniqueValue": "{{PRET16506squareOrderId}}",
    "secondaryValue": "false"
  }
}
```

### Conventions

- **`test_title` must contain the batch tag and Zephyr key**: `[Batch1][PRE-T16506]`. The `TAG` filter matches the `[batchN]` token; reports/Zephyr read the `PRE-Txxxx` key.
- **`orderKeyPrefix`** (e.g. `PRET16506`) namespaces stored values: `{{<prefix>squareOrderId}}`, `{{<prefix>onDemandOrderSync>}}`, etc.
- **On-demand sync key** = `{locationId}-{squareOrderId}` (orders) / `{locationId}-{refundToken}` (refunds).
- Payload/response files are named `<test>_<step>.json` under `test-data/.../<PRETxxxxx>/`.

## Data-creation handlers (`squareDataCreation.js`)

`dataCreationMethod` names a handler that calls the Square API and stores ids on the map.
Examples: `createSquareOrderSingleLineBase`, `createSquareOrderLineDiscount25`,
`createSquareOrderMultiPayment`, `createSquareReturnOrder`, `createSquareRefund`,
`ensureOnDemandRefundSync`. Add a new scenario by adding a handler + registering it.

## Adding a new TC — checklist

```
- [ ] Pick/confirm the Zephyr key (PRE-Txxxx) — it must exist in Zephyr project PRE
- [ ] Add an interaction to the right batch JSON (test, test_title with [batchN][PRE-Txxxx])
- [ ] Create payload files under test-data/Square_Suite/.../<PRETxxxxx>/
- [ ] Create <test>_expectedResponse1.json with expected NS fields (variances = 0)
- [ ] Reuse an existing dataCreationMethod, or add a handler in squareDataCreation.js
- [ ] Run it: env NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite TAG=batchN npm run jest
- [ ] Confirm validation passes (all variances 0); tune expectedResponse if needed
```

## Regenerating batch JSON

After changing generators:
```bash
export SQUARE_FLOW_PROFILE=quick
node scripts/generateSquareBatch1.js
node scripts/generateSquareBatch2Batch3.js
node scripts/generateSquareBatch4.js
node scripts/generateSquareBatches5to9.js
# Returns:
node scripts/generateSquareReturnSmoke.js
node scripts/generateSquareReturnBatch1.js
node scripts/generateSquareReturnBatch2.js
```
