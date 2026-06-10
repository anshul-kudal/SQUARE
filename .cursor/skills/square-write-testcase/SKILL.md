---
name: square-write-testcase
description: Author or add a new SQUARE (Square→NetSuite) test case — batch JSON interaction, payload + expected-response files, data-creation handler, and validation. Use when the user asks to write/add a new Square TC, add a scenario to a batch, create payloads/expected responses, or map a Zephyr key like PRE-Txxxx.
---

# Write / add a SQUARE test case

Read `docs/WRITING-TESTCASES.md` for full detail. Summary below.

## Layout
- Batch JSON: `testcases/Square_Suite/Order_Import/Batch<N>_*.json` (or `Return_Import/`)
- Payloads + expected: `test-data/Square_Suite/<Suite>/Batch<N>/<PRETxxxxx>/`
- Handlers: `helpers/squareDataCreation.js`; Scenarios: `helpers/square*Scenarios.js`

## Steps
1. Confirm the Zephyr key (`PRE-Txxxx`) exists in project PRE.
2. Add an interaction to the batch JSON with:
   - `test`, and `test_title` containing `[batchN][PRE-Txxxx]`
   - `pre_request[]`: resolve integration/flow ids, push flow status, then a Square
     create step with `dataCreationMethod` + `orderKeyPrefix` (e.g. `PRET16506`)
   - `validation`: `verifyCashsaleDataFromNetsuite` (orders) or
     `verifyCashRefundDataFromNetsuite` (refunds), `body` → expected JSON,
     `uniqueValue: {{<prefix>squareOrderId}}`
3. Create payload files + `<test>_expectedResponse1.json` (expected NS fields).
4. Reuse a `dataCreationMethod` or add a new handler in `squareDataCreation.js`.
5. Run: `env NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite TAG=batchN npm run jest`
6. Validation passes only when **all variances = 0** — tune the expected JSON, not the validator.

## Conventions
- On-demand sync key: `{locationId}-{squareOrderId}` (order) / `{locationId}-{refundToken}` (refund).
- `orderKeyPrefix` namespaces stored values: `{{<prefix>squareOrderId}}`, etc.
- Keep secrets out of testcase/payload files; reference `process.env[...]` for connection ids.
