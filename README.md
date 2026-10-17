# review-pull-request

AI code reviewer for GitHub pull requests. A GitHub webhook queues a review job; a worker reads the PR diff at a specific commit, asks an LLM for findings, and posts a GitHub review with inline comments pinned to that commit.

Built with NestJS, BullMQ (Redis), TypeORM (Postgres) and an OpenAI-compatible chat completions API.

## Flow

```mermaid
flowchart TD
    A["GitHub: PR opened or pushed"] --> B["Verify signature and event"]
    B --> C["Fetch current head SHA, bump desired_sha and generation"]
    C --> D["Replace waiting job, enqueue latest"]
    D --> E["Worker picks up job"]
    E --> F{"SHA and generation still latest?"}
    F -->|no| X["Drop job or result"]
    F -->|yes| G["Read diff at SHA"]
    G --> H["AI analysis, findings"]
    H --> I["Validate lines, remove duplicates"]
    I --> J{"Still latest before posting?"}
    J -->|no| X
    J -->|yes| K["Create GitHub review with inline comments"]
    K --> L["Store review ID and published SHA"]
```

Each PR has at most one wanted review: the latest head commit. Every review states which commit it covers.

| Module | Folder | Role |
| --- | --- | --- |
| `GithubModule` | `src/github/` | Webhook controller, signature check, `pull_request` action filter |
| `ReviewModule` | `src/review/` | Producer (head SHA check, state bump, enqueue), worker, staleness checks, publish, per-PR state in Postgres |
| `DiffModule` | `src/diff/` | PR diff at a SHA via the compare API, line-number annotation |
| `TaskModule` | `src/task/` | Task key lookup and task description from the task API |
| `AiModule` | `src/ai/` | LLM call, parse findings |
| `OctokitModule` | `src/octokit/` | Shared authenticated GitHub client |
| `common` | `src/common/` | Basic auth for the queue dashboard |

### Design notes

- **Generation.** `bump()` updates `desired_sha` and increments `generation` in one SQL statement, and only when the SHA changes, so redelivered webhooks do not create new work.
- **Out-of-order webhooks.** The producer uses the PR's current head from the GitHub API, not the SHA in the payload.
- **Stale work.** The worker checks SHA and generation before the AI call and again before posting. A running job cannot be cancelled, so the second check discards outdated results.
- **Pinned reviews.** Reviews are created with `commit_id` set to the analysed SHA, so a push between the check and the post cannot misplace comments.
- **Retries.** The review body carries a `<!-- ai-review sha=... -->` marker. Before posting, the worker looks for an existing review with that marker and reuses it instead of posting twice.
- **Task check.** The producer finds a task key such as `IC20-9` in the branch name, PR title, or PR body. The worker fetches the task from `TASK_API_URL/v1/tasks/<key>` and the model checks the diff against its description. If no key is found or the task API fails, the review runs on the diff alone.
- **Inline comments.** Patch lines are annotated with new-file line numbers for the model; findings outside the diff are dropped, since GitHub rejects them.

## Setup

Requirements: Node.js, Yarn, Docker.

```bash
yarn install
docker compose up -d   # Redis + Postgres
```

Create `.env`:

```dotenv
REDIS_HOST=localhost
REDIS_PORT=6379
DATABASE_URL=postgres://review:review@localhost:5432/review

GITHUB_WEBHOOK_SECRET=<webhook secret>
GITHUB_TOKEN=<token with pull request read/write>

AI_BASE_URL=https://gateway.9arm.co/v1
AI_MODEL=qwen3.8-27b-fp8
AI_API_KEY=<api key>

TASK_API_URL=http://localhost:8069
TASK_API_KEY=<task api key>

BULL_BOARD_USER=admin
BULL_BOARD_PASSWORD=<password>
```

The schema is created automatically on boot (`synchronize: true`).

## Run

```bash
yarn start:dev    # watch mode
yarn build && yarn start:prod
```

## Queue dashboard

[Bull Board](https://github.com/felixmosh/bull-board) runs at `http://localhost:3000/queues`. It uses HTTP Basic auth with `BULL_BOARD_USER` and `BULL_BOARD_PASSWORD`. The dashboard can retry and delete jobs, so keep the password secret.

## GitHub webhook

In the repository settings, add a webhook:

- **Payload URL:** `https://<host>/github/event/pull-request`
- **Content type:** `application/json`
- **Secret:** same value as `GITHUB_WEBHOOK_SECRET`
- **Events:** Pull requests

Handled actions: `opened`, `synchronize`, `reopened`, `ready_for_review`. Other events return `ignored`, and `ping` returns `pong`.

### Test locally

Save a `pull_request` payload as `payload.json`, sign it, and send it. The payload must point at a PR you are willing to have reviewed, because the worker posts real comments.

```bash
SIG=$(openssl dgst -sha256 -hmac "$GITHUB_WEBHOOK_SECRET" payload.json | awk '{print $NF}')
curl localhost:3000/github/event/pull-request \
  -H 'X-GitHub-Event: pull_request' \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -H 'Content-Type: application/json' \
  --data-binary @payload.json
```

Use `--data-binary` so the body bytes match the signature. In fish, write `set SIG (...)` instead of `SIG=$(...)`.

The same head SHA is reviewed only once. To review it again, clear the stored SHA so the next webhook bumps the generation. Do not delete the row: the generation would restart at 1 and collide with a completed job ID still kept in Redis.

```sql
UPDATE pr_review_state SET desired_sha = '' WHERE repository = 'owner/repo' AND pr_number = 1;
```

## Development

```bash
yarn test         # unit tests (vitest)
yarn lint         # oxlint
yarn format       # prettier
```

Husky hooks:

- **pre-commit:** lint-staged runs prettier on staged `.ts` files.
- **commit-msg:** commitlint (`@commitlint/config-angular`), for example `feat(review): add retry marker`.

## Known limits

- Only the diff is sent to the model, not full file contents.
- Diffs longer than 100,000 characters are truncated.
- The compare API returns at most 300 files and omits very large patches.
- `bump()` and the queue add are not atomic. If the add fails, that SHA waits for the next push.
- `synchronize: true` is for development. Use TypeORM migrations before production.
