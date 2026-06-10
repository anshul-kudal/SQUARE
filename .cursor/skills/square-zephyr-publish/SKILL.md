---
name: square-zephyr-publish
description: Publish Square → NetSuite automated test run results to a Zephyr Scale test cycle. Creates one timestamped cycle in the latest release folder, adds a test execution per TC with Pass/Fail status, assigns it to the configured user, and adds a comment with the Square Order ID and NetSuite Cash Sale ID as proof. Use when the user asks to publish/push test results to Zephyr, create a Zephyr test cycle from a run, log executions, or mentions ZEPHYR_PUBLISH, test cycles, or PRE-R cycle keys.
---

# Square → Zephyr Test Cycle Publishing

Publishes Square demo/test run results to **Zephyr Scale Cloud** (project `PRE`): one
test cycle per run, one execution per TC (Pass/Fail), assigned to a user, with the
test data + order IDs in the execution comment as proof.

## Capabilities

- Creates a test cycle named `Square Demo — <YYYY-MM-DD HH:mm IST>`.
- Drops the cycle into the **latest release folder** (e.g. `2026.7.1`) automatically
  (highest `YYYY.M.P` folder; advances when a newer one is added).
- Per executed TC: `POST /testexecutions` with `statusName` Pass/Fail,
  `assignedToId`/`executedById` = configured account, and an HTML `comment`
  containing Square Order ID, NetSuite Cash Sale ID, run time, environment, log file.
- Skips TCs that did not run (NOT_RUN); skips publish entirely if credentials missing.

## One-time setup (per user / per clone)

Credentials live in `env/zephyr.env` (gitignored — never committed). Each user
creates their own. Required keys:

```bash
ZEPHYR_API_TOKEN=<zephyr scale api token>
ZEPHYR_BASE_URL=https://api.zephyrscale.smartbear.com/v2
ZEPHYR_PROJECT_KEY=PRE
ZEPHYR_ASSIGNEE_ACCOUNT_ID=<your jira/zephyr accountId>
```

Optional keys (have working defaults for the celigo PRE instance):

```bash
ZEPHYR_APP_URL=<jira zephyr app base url>   # for printing clickable cycle links
ZEPHYR_JIRA_PROJECT_ID=14586                 # numeric Jira project id for links
ZEPHYR_FOLDER_NAME=2026.7.1                  # override target folder by name
ZEPHYR_FOLDER_ID=43758905                    # or override by numeric id
```

### Getting the token
- Reuse the token already configured in the Zephyr MCP at `~/.cursor/mcp.json`
  (`CeligoZephyr` → `env.ZEPHYR_TOKEN`), or
- Generate one in Jira: profile avatar → **Zephyr Scale API Access Tokens** →
  **Create access token** (direct page if the menu item is missing:
  `https://<site>.atlassian.net/plugins/servlet/ac/com.kanoah.test-manager/api-access-tokens`).

### Getting the accountId
- It is embedded in the Zephyr token's JWT payload (`context.user.accountId`), or
- From your Jira profile URL: `.../jira/people/<accountId>`.

## Usage

### Auto-publish from a demo run (opt-in flag)

```bash
ZEPHYR_PUBLISH=1 ./scripts/runSquareDemo.sh 1-2
ZEPHYR_PUBLISH=1 ./scripts/runSquareDemo.sh all
```

Without `ZEPHYR_PUBLISH=1`, runs behave normally and publish nothing.

### Publish a previous run's log manually

```bash
node scripts/publishToZephyr.js /tmp/square_demo_run.log
```

Reads `/tmp/square_demo_manifest.json` for the selected TCs and the log for
per-TC status + Square Order ID + NS Cash Sale ID.

## How it works

- `scripts/publishToZephyr.js` — entry point. Loads `env/zephyr.env`, parses the run
  via `buildRows()` from `scripts/generateSquareDemoReport.js`, resolves the latest
  folder, creates the cycle, then one execution per TC.
- TC keys come from `helpers/squareDemoConfig.js` (`zephyr` field, e.g. `PRE-T16506`).
- Status mapping: run `PASS` → `Pass`, `FAIL` → `Fail`.

## Verify after publishing

The script prints the cycle key (e.g. `PRE-R442`) and a clickable Jira link. To
confirm via API:

```bash
curl -s -H "Authorization: Bearer $ZEPHYR_API_TOKEN" \
  "https://api.zephyrscale.smartbear.com/v2/testexecutions?testCycle=<CYCLE_KEY>&maxResults=10"
```

Check each execution has the expected `statusName`, `assignedToId`, and `comment`.

## Notes

- The Zephyr MCP (`CeligoZephyr`) only does test-case reads/updates; it cannot create
  cycles or executions. This skill uses the Zephyr Scale REST API directly.
- Every run creates a NEW timestamped cycle; it does not reuse cycles.
- Execution statuses available in project PRE: `Not Executed`, `In Progress`, `Pass`,
  `Fail`, `Blocked`.
