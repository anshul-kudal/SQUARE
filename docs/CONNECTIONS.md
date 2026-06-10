# CONNECTIONS — NS / Square / IO

All real values live in `env/E2E_Square.env` (copy from `env/E2E_Square.env.example`,
gitignored). Never hardcode these in code or commit them.

## Integrator.io (IO)

| Env var | Purpose |
|---------|---------|
| `BASE_URL`, `API_V1`, `Integrator.baseurl` | IO environment (default IAQA staging) |
| `Integrator.userName` / `Integrator.password` | base64 email/password |
| `Integrator.token` | base64 `Bearer <token>` — used for all IO API calls |
| `CONNECTIONS.IO_CONNECTOR_IDENTIFIER` | `Square - NetSuite` (integration name) |
| `CONNECTIONS.SQUARE_INTEGRATION_ID` / `SQUARE_NS_INTEGRATION` | Integration id |
| `SQUARE_FLOWS.ORDER_CASHSALE_ID` | Order → Cash Sale flow id |
| `SQUARE_FLOWS.REFUND_CASHREFUND_ID` | Refund → Cash Refund flow id |

> The `Integrator.token` MUST have **connection export/import** permission, otherwise
> refund indexing fails (`422 not valid Refunds`). Verify with
> `node scripts/squareIoExportPreflight.js`.

## Square

| Env var | Purpose |
|---------|---------|
| `CONNECTIONS.SQUARE` | Square connection id (also mirrored to `CONNECTIONS.SHOPIFY_STORE_1`) |
| `CONNECTIONS.SQUARE_TOKEN` | base64 Square access token (Square API auth) |
| `SQUARE_PRIMARY_STORE_DATA.LOCATION_ID` | Square location (used in on-demand sync keys) |
| `SQUARE_PRIMARY_STORE_DATA.STORE_ID` / `STORE_NAME` | Store identity |
| `SQUARE_CATALOG.*` | Catalog item / variation / tax / modifier IDs |

Catalog setup helpers (Batch 4+ needs extended catalog):
```bash
node scripts/discoverSquareCatalog.js
node scripts/setupSquareExtendedCatalog.js
node scripts/setupSquareBatch4Catalog.js
```
Discovered IDs are written to `config/squareCatalogIds.json` (gitignored).

## NetSuite (NS)

| Env var | Purpose |
|---------|---------|
| `CONNECTIONS.NETSUITE` | NS connection id (validation runs through its proxy) |
| `CONNECTIONS.NS_ACCOUNT_IDENTIFIER` | NS account (e.g. `TSTDRV1463095`) |
| `DEFAULT_CUSTOMER.*` | Default NS customer (id, email, name) |
| `NS_LOCATION_ID.ID` | NS location internal id (e.g. `6`) |
| `NS_TAX_PREFERENCE_DETAILS.*` | Tax preference script/deploy ids |

> Known gap: refund expected JSON may reference `NS_DEFAULT.LOCATION1` which is not in
> the example. Add it if refund validation needs it. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Framework "store slot" note

The automation framework keys some Square data under legacy `SHOPIFY_*` names
(`SHOPIFY_PRIMARY_STORE_DATA.*`, `CONNECTIONS.SHOPIFY_STORE_1`). Keep these set to the
Square values — they are required by `@celigo/rest-api-ia-automation`.
