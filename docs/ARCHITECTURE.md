# Architecture

Technical design of Sentinel. These are the decisions we made and why. Some are opinionated.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           GitHub                                     │
│  (push events, PR events, deployment events)                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ webhook
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Next.js Application                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ Webhook Handler │  │   tRPC API      │  │   Dashboard     │     │
│  │ /api/webhooks/* │  │ /api/trpc/*     │  │ /dashboard/*    │     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
└───────────┼────────────────────┼────────────────────┼───────────────┘
            │                    │                    │
            ▼                    ▼                    │
┌───────────────────┐  ┌───────────────────┐         │
│   Redis (BullMQ)  │  │    PostgreSQL     │◄────────┘
│   Job Queues      │  │    Database       │
└─────────┬─────────┘  └───────────────────┘
          │                    ▲
          ▼                    │
┌─────────────────────────────────────────────────────────────────────┐
│                        Worker Process                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Webhook    │  │   Analysis   │  │  Scheduled   │              │
│  │   Worker     │  │   Worker     │  │   Worker     │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         ▼                 ▼                 ▼                       │
│  ┌──────────────────────────────────────────────────┐              │
│  │              Notification Worker                  │              │
│  │         (Slack, Email, PagerDuty)                │              │
│  └──────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Core Tables

**organizations** — Multi-tenant root. Each org has repos, members, API keys.

**repositories** — Tracked repos. Links to GitHub via `github_id` and `installation_id`.

**code_events** — Raw event stream from GitHub. Every commit, PR open/review/merge, deploy gets a row. This is the source of truth for "what happened."

**code_attribution** — AI detection results per commit per file. Contains confidence score, detection signals, risk tier, complexity metrics.

**repo_metrics** — Pre-computed daily aggregates. Powers the dashboard without expensive on-demand queries.

**alerts** — Triggered alert history. Includes delivery status and acknowledgment tracking.

**incidents** — Production incidents. Linked to suspected commits for AI attribution analysis.

### Key Relationships

```
organizations
    ├── organization_members (user_id from Clerk)
    ├── repositories
    │       ├── code_events
    │       ├── code_attribution
    │       ├── repo_metrics
    │       ├── incidents
    │       └── alerts
    ├── github_installations
    └── api_keys
```

### Indexes

We optimized for reads over writes. Dashboard queries need to be fast (<100ms), ingestion can be slower. This meant:

- `code_events(repo_id, timestamp DESC)` — Recent events for a repo
- `code_events(commit_sha)` — Lookup by commit (partial index, non-null only)
- `code_attribution(repo_id, ai_confidence DESC)` — High-confidence AI code
- `code_attribution(commit_sha, file_path)` — Unique constraint + lookup
- `repo_metrics(repo_id, date DESC)` — Latest metrics for dashboard
- `alerts(repo_id, triggered_at DESC)` — Recent alerts

## API Layer

### tRPC Routers

**metrics** — Dashboard data
- `getRepoOverview` — Summary cards (AI %, tax, risk files, incidents)
- `getRepoMetrics` — Time series for charts
- `getHighRiskFiles` — Files with T3/T4 risk

**events** — Code events
- `getCodeEvents` — Paginated event feed
- `getEventById` — Single event details

**incidents** — Incident tracking
- `getIncidents` — List with AI attribution
- `getIncidentById` — Full incident details

**alerts** — Alert management
- `getAlerts` — Filtered alert list
- `getSummary` — Alert counts and most recent
- `acknowledge` — Mark alert as seen

### Context

Every tRPC procedure receives `ctx.db` (Drizzle client). Auth context would be added here when Clerk is integrated.

## Background Jobs

### Queues

We went with BullMQ after Redis Streams gave us problems with exactly-once delivery. BullMQ handles retries, backoff, and job deduplication without us having to think about it.

**webhooks** — GitHub events come in here. Has to be fast — GitHub times out webhooks after 10 seconds and we want headroom.

**analysis** — AI detection work. Can take a few seconds per commit since we hit the GitHub API. Retries automatically on rate limits.

**scheduled-jobs** — Cron stuff. Originally tried node-cron but BullMQ's repeatable jobs are more reliable across restarts.

**notifications** — Alert delivery. Separate queue so a Slack outage doesn't block everything else.

### Scheduled Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| compute-metrics-daily | 2am PT | Aggregate yesterday's data |
| track-survival-weekly | 3am Sunday | Code survival analysis |
| monitor-saturation-hourly | 9am-6pm weekdays | Review queue health |

### Idempotency

Jobs can run multiple times safely. This matters because workers crash, deploys happen, and Redis connections drop.

```typescript
const lock = await acquireLock("compute-metrics", repoId, date);
if (!lock) return; // Someone else is doing it
try {
  await doWork();
} finally {
  await releaseLock(lock);
}
```

The lock implementation took a few iterations to get right. Simple `SET NX` doesn't work because if worker A crashes mid-job, worker B can't tell if A is still running or dead. We use UUID tokens now — each lock has a random token, and you can only release it if you have the matching token. The release uses a Lua script so the check-and-delete is atomic.

Learned this the hard way when duplicate metrics appeared in the database during a deploy.

## AI Detection Engine

This is heuristics, not ML. We considered training a model but the signal-to-noise ratio from simple rules turned out to be good enough, and it's way easier to debug "why did this get flagged" when it's just if-statements.

### Signal Sources

1. **Commit Message** — "Co-authored-by: GitHub Copilot" is a dead giveaway (+0.9). GitHub added this automatically and most people don't remove it.
2. **PR Description** — Mentions of "copilot", "cursor", "claude", "chatgpt" etc. (+0.7). People love to mention they used AI.
3. **Velocity** — 500+ lines in under 5 minutes (+0.6). Humans don't type that fast. False positives on large file moves but those are usually obvious.
4. **Time of Day** — 2-4am commits (+0.3). Weak signal on its own, but correlates. People don't usually write code at 3am unless an AI is helping.
5. **Code Style** — Generic variable names, excessive comments, boilerplate patterns (+0.4). Harder to tune, lots of edge cases.

Signals combine with diminishing returns. Two strong signals don't make 1.8 — more like 0.95. Prevents overconfidence when multiple weak signals fire.

### Risk Classification

```
T1 (Boilerplate)  — Config, tests, scripts, docs
T2 (Glue)         — API routes, basic CRUD, utilities
T3 (Core)         — Auth, payments, business logic
T4 (Critical)     — Novel algorithms, security-sensitive code
```

Classification uses file path patterns first (auth/* → T3 minimum), then adjusts based on AI confidence. High-confidence AI code in critical paths gets flagged.

Low AI confidence (<30%) downgrades risk tier to prevent false positives on human-written code.

## Alert Rules Engine

### Evaluation Flow

```
Metrics Job Completes
        │
        ▼
Load Current Metrics
        │
        ▼
Load Previous Metrics (for comparison)
        │
        ▼
┌───────────────────────┐
│  For Each Rule:       │
│  1. Evaluate trigger  │
│  2. Check dedup       │
│  3. Create alert      │
│  4. Queue notification│
└───────────────────────┘
```

### Deduplication

Same rule + same repo = one alert per 24 hours. Prevents alert storms when metrics hover around thresholds.

### Event-Triggered Rules

Some rules don't run on metrics:

- **high_risk_deployed** — Triggered by deploy webhook when files include T4 code
- **incident_ai_attributed** — Triggered when incident is created with AI attribution

These bypass the metrics job and create alerts directly.

## Data Flow Examples

### Push Event → Dashboard Update

1. GitHub sends push webhook
2. Webhook handler verifies signature, finds repo, queues job
3. Webhook worker parses commits, stores `code_events`
4. For each commit, queues analysis job
5. Analysis worker fetches commit from GitHub API
6. Runs AI detection heuristics
7. Stores `code_attribution` with confidence and risk
8. Next morning, metrics job aggregates into `repo_metrics`
9. Dashboard queries `repo_metrics` for fast display

### Alert → Notification

1. Metrics job completes
2. Calls `evaluateAlertsForRepo()`
3. Rule `ai_code_critical` triggers (95% > 90%)
4. Checks dedup — no alert in last 24h
5. Creates row in `alerts` table
6. Queues notification job with alert ID
7. Notification worker loads alert + repo
8. Sends to configured channels (Slack, Email)
9. Updates `alerts.sent_at`

## Scaling Considerations

The current architecture handles a decent amount of load without breaking a sweat. We haven't needed to scale yet, so take this section as "what we'd do if we had to" rather than battle-tested advice.

### Current State

- Single worker process handles all queues (it's fine, workers are mostly I/O bound)
- PostgreSQL for everything, no replicas
- No caching layer besides React Query's default staleness

### When We'd Actually Scale

**>100 repos tracked** — `code_events` table will get big. Partition by month, archive old data to cold storage. The table is append-only so this is straightforward.

**>1000 webhooks/minute** — Split workers. Run webhook processing on one box, analysis on another. BullMQ makes this trivial, just point at the same Redis.

**Dashboard feels slow** — Probably the aggregation queries. Add a Redis cache in front of `repo_metrics`, serve from cache, update on job completion.

**Metrics job taking forever** — Parallelize across repos. Currently loops sequentially. Could fan out to separate jobs per repo.

### Things We're Not Doing

- Kubernetes. A $20/month VPS handles this fine. K8s is for when you have real scale problems, not imaginary ones.
- Read replicas. The indexes handle the read load. Writes are low volume.
- TimescaleDB or ClickHouse. Considered it for `code_events`, but Postgres with proper indexes is fast enough and we don't need the operational overhead.
- Kafka. BullMQ + Redis handles our throughput. If we hit Kafka-level scale we'll have different problems.

Build for the load you have, not the load you hope to have.
