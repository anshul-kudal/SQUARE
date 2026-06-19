# Secrets & Credentials — Storage and Handling Guide (SQUARE)

How tokens and secrets are stored for the **Square → NetSuite** test automation, and how to keep them safe. Share this with anyone setting up or maintaining the suite.

> **Golden rule:** the only place secrets live on disk is `env/E2E_Square.env`. That file is **gitignored and must never be committed**. NetSuite/Shopify credentials are *not* on disk at all — they live encrypted inside Integrator.io.

---

## 1. Where each credential lives (by layer)

| Credential | Stored where | On disk / in repo? |
|---|---|---|
| **NetSuite auth** (consumer + token key/secret) | Integrator.io **Connection** object — encrypted at rest on Celigo servers | ❌ No. Repo only holds the connection **ID** (`CONNECTIONS.NETSUITE`) |
| **Shopify auth** | Integrator.io **Connection** (encrypted) | ❌ No — only the connection ID |
| **IO account access** | `REFRESH_MAP` — OAuth refresh-token map used to mint IO API tokens | ⚠️ Yes, in `env/E2E_Square.env` |
| **Square API token** | `CONNECTIONS.SQUARE_TOKEN` (tests call Square directly) | ⚠️ Yes, in `env/E2E_Square.env` |
| **ReportPortal** | `RP_TOKEN`, `RP_API_KEY` | ⚠️ Yes, in `env/E2E_Square.env` |

**Everything else** in the env (`API`, `API_V1`, `BASE_URL` = URLs; `NS_LOCATION_ID`, tax script/deploy IDs, catalog IDs, customer/product defaults) is **config/identifiers, not secrets**.

### How NetSuite calls work without NS creds on disk
Tests call `…/connections/{CONNECTIONS.NETSUITE}/proxy`. Integrator.io looks up that connection by ID and uses the stored (encrypted) NetSuite credentials to talk to NetSuite on the test's behalf. The test never sees the NS secrets.

➡️ To view/rotate NS or Shopify creds: **IO UI → Resources → Connections → select the connection**. Secrets can be re-entered but never read back (by design).

---

## 2. The 4 secrets you must protect

These are the only sensitive values, all inside `env/E2E_Square.env`:

1. `REFRESH_MAP` — **most powerful**: grants access to the IO account and, through it, every connection (NetSuite, Shopify, Square).
2. `CONNECTIONS.SQUARE_TOKEN` — Square API token.
3. `RP_TOKEN` — ReportPortal token.
4. `RP_API_KEY` — ReportPortal API key.

---

## 3. Where to STORE the secret file safely

- **Primary store:** a secrets manager / password vault — 1Password, Bitwarden, HashiCorp Vault, or your company's approved vault. Store the `env/E2E_Square.env` contents as a secure note or per-key entries.
- **Never** store it in: Git, Slack, email, shared drives, screenshots, or chat.
- **Local copy:** keep only the working copy at `env/E2E_Square.env`. If you must back it up locally, encrypt it (e.g. an encrypted disk image / `age`/`gpg`), don't leave a plaintext `.env.backup` lying around.
- **Note:** `~/Documents` may be cloud-synced (iCloud/Drive). A plaintext secrets file there can sync to the cloud — prefer the vault.

---

## 4. New teammate setup (safe path)

```bash
# 1. Clone and install
git clone https://github.com/anshul-kudal/SQUARE.git && cd SQUARE
npm install

# 2. Create the local env from the committed, secret-free template
cp env/E2E_Square.env.example env/E2E_Square.env

# 3. Fill in the 4 secrets + connection IDs FROM THE VAULT (never paste them in chat/PRs)
#    REFRESH_MAP, CONNECTIONS.SQUARE_TOKEN, RP_TOKEN, RP_API_KEY, CONNECTIONS.* ids
```

`env/E2E_Square.env.example` is committed and contains **no secrets** — it's the only env file that should ever be in Git.

---

## 5. Handling rules (do / don't)

**Do**
- Keep secrets only in `env/E2E_Square.env` (gitignored) + the vault.
- Use the framework `Logger` and log only IDs/safe fields. Treat `err.message` from connection/encryption paths as potentially containing a secret — sanitize before logging.
- Rotate immediately if a secret is shared, screenshotted, or suspected leaked:
  - `REFRESH_MAP` → re-auth the IO OAuth connection
  - `CONNECTIONS.SQUARE_TOKEN` → regenerate in Square
  - `RP_TOKEN` / `RP_API_KEY` → regenerate in ReportPortal

**Don't**
- Never `git add -f env/…` (force-add bypasses the ignore rule).
- Never commit `env/E2E_Square.env`, `report/*`, or `logs/*`.
- Never log tokens, the `REFRESH_MAP`, passwords, PII, or full request/response bodies.

---

## 6. Git safety (verified)

- `.gitignore` blocks `env/*` (only `env/.gitkeep` and `env/*.example` are tracked).
- `env/E2E_Square.env` has **never been committed** to any branch — confirmed via `git log --all --full-history -- env/E2E_Square.env` (returns nothing).
- Quick re-check anytime:

```bash
git log --all --full-history -- env/E2E_Square.env   # expect: no output
git check-ignore -v env/E2E_Square.env               # expect: matches env/* rule
```

---

*Owner: QA Automation · Review this doc whenever connections, tokens, or the vault location change.*
