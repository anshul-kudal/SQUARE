# Clone & Run Setup (what git does NOT give you)

A fresh `git clone` of SQUARE is **not runnable as-is** — a few required files are intentionally gitignored (secrets) or currently missing from the remote. This is the checklist to get a clone running. See `docs/secrets-management.md` for the secrets detail.

## 1. Files you must add after cloning

| File | In git? | How to obtain | Notes |
|------|---------|---------------|-------|
| `env/E2E_Square.env` | ❌ gitignored | Get the real file from the owner via a **secure channel / vault** (never Slack/email/git) | Contains all secrets + connection IDs + `NS_DEFAULT.LOCATION1` |
| `config/ia.ts` | ❌ missing on remote | Provided in the share pack (or copy below) | The committed `global.spec.ts` imports `../config/ia`, which was never pushed — clone fails to compile without it. |
| `.npmrc` | ❌ (per-user) | Configure Celigo npm registry auth | Needed for `npm install` of `@celigo/rest-api-ia-automation` |

`config/ia.ts` minimal stub (unblocks compile; `ia` is currently unused in the spec):

```ts
export const ia = {};
```

## 2. Steps

```bash
git clone https://github.com/anshul-kudal/SQUARE.git && cd SQUARE
# configure ~/.npmrc for the Celigo registry, then:
npm install

# place the two files from the share pack:
cp /path/from/pack/E2E_Square.env env/E2E_Square.env
cp /path/from/pack/ia.ts          config/ia.ts   # only until the team commits the real one
```

## 3. Run

```bash
# Orders (single batch)
env NODE_ENV=dev SETUP=E2E_Square PBI=SQNS SUITE=Square_Suite TAG=batch1 npm run jest

# Refund smoke (scheduled-pull mode is the default in the runner)
./scripts/runSquareReturnSmoke.sh
```

## 4. Required env keys (names only — fill values from the vault)

Secrets: `Integrator.token`, `Integrator.userName`, `Integrator.password`, `REFRESH_MAP`, `CONNECTIONS.SQUARE_TOKEN`, `RP_TOKEN`, `RP_API_KEY`.
Config/IDs: `Integrator.url`, `Integrator.baseurl`, `API`, `API_V1`, `BASE_URL`, `ENVIRONMENT`, `CONNECTIONS.*`, `SQUARE_FLOWS.*`, `SQUARE_CATALOG.*`, `NS_*` (incl. `NS_DEFAULT.LOCATION1=Amazon CA location`), `DEFAULTS.*`, `DEFAULT_CUSTOMER.*`.

Use `env/E2E_Square.env.example` as the template skeleton.

## 5. Known remote gaps to fix upstream
- Commit the real `config/ia` (or remove the unused import from `__tests__/global.spec.ts`) so clones compile without the stub.
