# Sentinel

**AI Code Safety Platform for Engineering Teams**

Observability and risk management when 40%+ of your codebase is AI-generated.

## What is this?

Sentinel helps engineering teams understand what happens when most of their code comes from GitHub Copilot, Cursor, Claude, or similar tools.

The problem isn't that AI-generated code is bad. The problem is that nobody knows:
- How much of the codebase is AI-written
- Whether reviewers are keeping up with the velocity
- Which AI code ended up in security-critical paths
- If that production incident was caused by AI code nobody understood

Sentinel answers these questions.

## The Core Metrics

**AI Code Percentage** — What portion of commits contain AI-generated code. We detect this through commit message patterns, PR descriptions mentioning AI tools, velocity anomalies, and coding style analysis.

**Verification Tax** — Hours spent reviewing AI code, converted to dollar cost. At $150/hr, 100 hours/week of review time is $60k/month. This number gets attention in budget meetings.

**Risk Tiers** — Not all AI code is equal. A Copilot-generated test file (T1) is different from AI-written payment processing logic (T4). We classify and track accordingly.

**Review Saturation** — Are your reviewers drowning? When PR review queue exceeds reviewer capacity, quality suffers. We measure this.

## Quick Start

```bash
# Clone and install
git clone https://github.com/SAY-5/Sentinel.git
cd sentinel
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your database, Redis, and GitHub App credentials

# Database
pnpm db:push
pnpm db:seed  # optional: creates test data

# Run it
pnpm dev           # Terminal 1: Next.js app
pnpm workers:dev   # Terminal 2: Background jobs
```

Open `http://localhost:3000/dashboard`

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- A GitHub App (for receiving webhooks)

## How It Works

```
GitHub webhook → /api/webhooks/github → Redis queue → Worker
                                                        ↓
                              Dashboard ← Database ← AI Detection
                                                        ↓
                                              Alert Evaluation
                                                        ↓
                                              Slack / Email / PagerDuty
```

1. Your GitHub App sends webhooks on push, PR, and deploy events
2. We queue them for async processing (webhooks must respond fast)
3. Workers analyze commits for AI signals and store attribution data
4. Background jobs compute daily metrics
5. Alert rules evaluate thresholds and notify when things get dangerous

## GitHub App Setup

Create one at https://github.com/settings/apps/new

**Webhook URL:** `https://your-domain.com/api/webhooks/github`

**Permissions needed:**
- Contents: Read-only
- Pull requests: Read-only
- Metadata: Read-only

**Events to subscribe:**
- Push
- Pull request
- Pull request review

Generate a webhook secret (`openssl rand -base64 32`) and download the private key.

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost:5432/sentinel
REDIS_URL=redis://localhost:6379
GITHUB_APP_ID=123456
GITHUB_WEBHOOK_SECRET=your-secret
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."

# Admin API (generate a random string)
ADMIN_API_KEY=your-admin-key

# Notifications (configure what you need)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
RESEND_API_KEY=re_xxxxxxxxxxxx
ALERT_EMAIL_TO=alerts@company.com
PAGERDUTY_ROUTING_KEY=your-key

# App URL (for links in notifications)
NEXT_PUBLIC_APP_URL=https://sentinel.yourcompany.com
```

## Alert Rules

Seven built-in rules. 24-hour deduplication so you don't get spammed when metrics hover around thresholds (learned that one the hard way during testing).

**Warning level (Slack only):**
- AI code >70% — time to pay attention
- Verification tax spiked >50% from last week
- Review saturation >80% — your reviewers are drowning

**Critical level (Slack + Email):**
- AI code >90% — your team might've forgotten how to code manually
- Verification tax >80h/week — that's $12k/month in review time

**Wake-someone-up level (Slack + Email + PagerDuty):**
- High-risk (T4) code just hit production
- Incident attributed to AI-generated code

## Admin API

Manually trigger jobs (useful for backfills):

```bash
# Compute metrics for a specific date
curl -X POST "http://localhost:3000/api/admin/metrics/compute?date=2026-01-27" \
  -H "X-Admin-Key: your-key"

# Backfill a date range
curl -X POST "http://localhost:3000/api/admin/metrics/compute?startDate=2026-01-01&endDate=2026-01-27" \
  -H "X-Admin-Key: your-key"
```

## Project Structure

```
src/
├── app/                    # Next.js pages
│   ├── api/               # API routes
│   │   ├── webhooks/      # GitHub webhook handler
│   │   ├── admin/         # Admin endpoints
│   │   └── trpc/          # tRPC handler
│   └── dashboard/         # Dashboard pages
├── server/
│   ├── db/                # Drizzle schema and client
│   ├── routers/           # tRPC routers
│   └── services/          # Business logic
├── workers/               # BullMQ workers
├── jobs/                  # Job definitions
├── alerts/                # Alert rules engine
├── analysis/              # AI detection heuristics
├── integrations/          # Slack, Email, PagerDuty
└── lib/                   # Shared utilities
```

## Tech Stack & Why

**Next.js 15 (App Router)** — Server components are genuinely useful for dashboards. Initial page load fetches data on the server, no loading spinners. Worth the occasional RSC headache.

**Drizzle ORM** — We tried Prisma first. The cold start times were killing our workers, and the query builder felt like writing SQL with extra steps. Drizzle is just TypeScript. You write queries, you get types, done. No schema.prisma file to keep in sync.

**BullMQ + Redis** — Went with this after Redis Streams gave us grief. BullMQ's retry logic and job deduplication work out of the box. We considered Temporal for the workflow stuff but it's overkill for what we need.

**tRPC** — Type safety from database to UI without generating code or writing OpenAPI specs. The devex is hard to go back from.

**Recharts** — It's not the prettiest charting library but it actually works with React 18 and doesn't fight you on SSR. Victory and Nivo both had weird hydration issues.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design and data flow
- [API Reference](docs/API.md) — tRPC routers and endpoints
- [Deployment](docs/DEPLOYMENT.md) — Production deployment guide
- [Contributing](docs/CONTRIBUTING.md) — How to contribute

## Why Build This?

Started as a side project after a conversation with an eng director who said "we're probably 60% Copilot code now" with zero confidence in that number. He had no way to verify it. His team's review queue had tripled. Two recent incidents traced back to AI-generated auth code that nobody fully understood.

The tooling landscape was weird — plenty of "AI code quality" scanners (basically linters with marketing), nothing for the operational questions. How much? How risky? How expensive to verify? Is it causing incidents?

We talked to teams at a few companies using AI heavily. Same story everywhere: velocity up, visibility down, reviewers drowning, incidents harder to attribute. Everyone had opinions, nobody had data.

So we built the thing that would've helped that eng director. Turns out a lot of teams need it.

## License

MIT

---

Built for engineering teams navigating the AI-accelerated era.
Testing production deployment
Testing production end-to-end
