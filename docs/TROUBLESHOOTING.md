# TROUBLESHOOTING — Known Issues & Fixes

## Jest exits 1 even when all tests pass
**Cause:** non-blocking `globalTeardown` error — `Jest: Got error running globalTeardown
... uploadReport.js, reason: msgs is not iterable`.
**Action:** ignore the exit code; trust the printed `TEST SUITE SUMMARY` and the
generated HTML report. Tests and Zephyr publishing still succeed.

## Refund TCs fail with `422 ... not valid Refunds`
**Cause:** IO never indexed the Square refund because
`POST /connections/{SQUARE}/export` returns **`401 access_restricted`** — the
`Integrator.token` lacks **connection export/import** permission.
**Fix:**
1. In integrator.io → My account → API tokens, create a token with connection
   export/import (manage connection data) permission.
2. Update `Integrator.token` in `env/E2E_Square.env` (base64 `Bearer <token>`).
3. Verify: `node scripts/squareIoExportPreflight.js` → expect `OK: connection export permitted`.
4. Re-run the return batches.

## Refund validation fails after indexing works
- Check `NS_DEFAULT.LOCATION1` — referenced by some refund expected JSON but missing
  from `env/E2E_Square.env.example`. Add it.
- Tune `<TC>_expectedResponse1.json` against the first real successful refund.

## On-demand refund sync never accepted
`ensureOnDemandRefundSync` polls `persistSettings` with key `{locationId}-{refundToken}`
until IO stops returning 422. If it never succeeds, the root cause is the export 401
above (refund not indexed). Fix the token first.

## NS validation returns empty / record not found
- NS write may not have settled. Increase `NS_SETTLE_DELAY_MS`,
  `NS_EMPTY_RESULT_RETRIES`, `NS_EMPTY_RESULT_DELAY_MS`.
- Confirm the saved-search patch applied (Square account lacks Shopify columns) — see
  [PROXY-AND-VALIDATION.md](PROXY-AND-VALIDATION.md).

## Flow returns 409 / still running
The framework retries on 409 and waits for the flow to go idle. If persistent, raise
`TEST_MAX_RETRIES` and avoid running the same flow concurrently.

## `npm install` fails for `@celigo/*`
`@celigo` packages come from GitHub Packages. Configure `~/.npmrc`:
```
@celigo:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=<your-github-token-with-read:packages>
```

## jest.config.js throws on a fresh clone
`jest.config.js` calls `getDataFromNodeProcess()`, which needs `env/E2E_Square.env`.
Copy it from the example first; this is expected, not a bug.
