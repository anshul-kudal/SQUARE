# ZEPHYR — Audit, Preview & Publish

Publish test run results to **Zephyr Scale Cloud** (project `PRE`): one timestamped
**test cycle** per run, one **execution** per TC (Pass/Fail), assigned to you, with the
Square Order ID + NS Cash Sale ID in the comment as proof.

> The Zephyr MCP only reads/updates test *cases*. It cannot create cycles or
> executions, so this uses the Zephyr Scale REST API directly via `scripts/publishToZephyr.js`.

## Setup (once)

```bash
cp env/zephyr.env.example env/zephyr.env   # gitignored — never commit real token
```
Fill in:

| Var | Required | How to get it |
|-----|----------|---------------|
| `ZEPHYR_API_TOKEN` | yes | Jira avatar → **Zephyr Scale API Access Tokens** → Create. Or reuse the token in `~/.cursor/mcp.json` (`CeligoZephyr` → `ZEPHYR_TOKEN`). |
| `ZEPHYR_BASE_URL` | yes | `https://api.zephyrscale.smartbear.com/v2` |
| `ZEPHYR_PROJECT_KEY` | yes | `PRE` |
| `ZEPHYR_ASSIGNEE_ACCOUNT_ID` | for assignee | Embedded in the token JWT (`context.user.accountId`) or from your Jira profile URL `.../jira/people/<accountId>` |
| `ZEPHYR_APP_URL`, `ZEPHYR_JIRA_PROJECT_ID` | optional | For clickable cycle links |
| `ZEPHYR_FOLDER_NAME` / `ZEPHYR_FOLDER_ID` | optional | Override target folder (default = latest release folder) |

## Publish

```bash
# Auto-publish after a demo run:
ZEPHYR_PUBLISH=1 ./scripts/runSquareDemo.sh 1-2

# Publish a previous run's log:
node scripts/publishToZephyr.js /tmp/square_demo_run.log
```

What it does:
1. Resolves the **latest release-version folder** (e.g. `2026.7.1`; auto-advances).
2. Creates cycle `Square Demo — <YYYY-MM-DD HH:mm IST>` in that folder.
3. For each executed TC: `POST /testexecutions` with `statusName` Pass/Fail,
   `assignedToId`/`executedById` = your account, and an HTML comment (Square Order ID,
   NS Cash Sale ID, run time, env, log file).
4. Prints the cycle key (e.g. `PRE-R442`) + Jira link.

Status mapping: run `PASS` → `Pass`, `FAIL` → `Fail`. NOT_RUN TCs are skipped.
Execution statuses in PRE: `Not Executed`, `In Progress`, `Pass`, `Fail`, `Blocked`.

## Preview / audit a cycle (verify it landed)

```bash
TOKEN=$(grep ZEPHYR_API_TOKEN env/zephyr.env | cut -d= -f2-)
# Cycle details (name, folder):
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.zephyrscale.smartbear.com/v2/testcycles/PRE-R442"
# Executions (status, assignee, comment):
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.zephyrscale.smartbear.com/v2/testexecutions?testCycle=PRE-R442&maxResults=10"
```
Confirm each execution has the expected `statusName`, `assignedToId`, and `comment`.

## Notes
- Every run creates a NEW cycle (cycles are not reused).
- Demo TC → Zephyr key mapping lives in `helpers/squareDemoConfig.js`.
- See the invokable skill `.cursor/skills/square-zephyr-publish/SKILL.md`.
