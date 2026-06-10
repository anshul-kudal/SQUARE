# PROXY & VALIDATION

## NS proxy

NetSuite records are read/validated through the IO connection proxy:
```
POST /connections/{CONNECTIONS.NETSUITE}/proxy
```
This avoids needing direct NS API access — IO forwards the saved-search request to NS.

### Square saved-search patch

The Square NS account (`TSTDRV1463095`) does **not** have Shopify-specific line columns.
`config/squareNsSavedSearchPatch.js` strips them so proxy validation works:

- Removed columns: `custcol_location_id`, `custcolcust_delivery_method_id`
- Patched column sets: `SALESORDER_COLUMNS`, `SALESORDER_COLUMNS_INV_STATUS_ENABLED`, `CASHSALE_COLUMNS`
- Applied once in `__tests__/globalSetup.js` (guarded by `__squarePatchApplied`).

### Order ↔ NS linkage
Square order id is stored on the NS record under `custbody_celigo_etail_order_id`
(surfaced as **eTail Order Id**). Validation looks up the NS record by this value
(`uniqueValue: {{<prefix>squareOrderId}}`).

### SQNS globalSetup behaviour
When `PBI=SQNS`, `__tests__/globalSetup.js`:
- registers Square data-creation handlers (`createSquareOrder*`, `createSquareRefund`, etc.),
- applies the saved-search patch,
- skips Shopify `taxSetupCheck`.

## Validation methods

| Method | Used by | Checks |
|--------|---------|--------|
| `verifyCashsaleDataFromNetsuite` | Order Import | NS Cash Sale vs `expectedResponse` |
| `verifyCashRefundDataFromNetsuite` | Return/Refund | NS Cash Refund vs `expectedResponse` |

Validation block in a testcase interaction:
```json
{
  "validation": {
    "dataValidationMethod": "verifyCashsaleDataFromNetsuite",
    "body": "/test-data/.../<TC>_expectedResponse1.json",
    "uniqueValue": "{{PRET16506squareOrderId}}",
    "secondaryValue": "false"
  }
}
```

### What "pass" means
- The NS record is found by `uniqueValue` (eTail Order Id).
- Every field in `expectedResponse` matches the NS record.
- **All variance fields = 0** (item, qty, rate, tax, discount, tip, totals).

### Tuning failures
If a validation fails, compare the logged `Expected JSON >>` against the actual NS
record and adjust the `expectedResponse` JSON — do **not** modify the validator.
Common fields: item, quantity, rate, `eTail Order Id`, eTail channel, tax/discount lines.
