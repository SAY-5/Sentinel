# Database Architecture

Sentinel uses PostgreSQL with Drizzle ORM for type-safe database access.

## Schema Overview

```
┌─────────────────────┐
│   organizations     │  Multi-tenant root entity
└──────────┬──────────┘
           │
     ┌─────┴─────┬──────────────────┬─────────────────┐
     │           │                  │                 │
     ▼           ▼                  ▼                 ▼
┌──────────┐ ┌──────────────┐ ┌─────────────────┐ ┌─────────┐
│org_members│ │github_installs│ │  repositories   │ │api_keys │
└──────────┘ └──────────────┘ └────────┬────────┘ └─────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
      ┌─────────────┐          ┌──────────────┐         ┌───────────┐
      │ code_events │          │code_attribution│        │ incidents │
      └─────────────┘          └──────────────┘         └───────────┘
                                       │
                                       ▼
                               ┌──────────────┐
                               │ repo_metrics │  Pre-computed aggregates
                               └──────────────┘
```

## Tables

### Core Entities

| Table | Purpose | Volume |
|-------|---------|--------|
| `organizations` | Multi-tenant root | Low (customers) |
| `organization_members` | User→Org mapping | Low |
| `github_installations` | GitHub App installs | Low |
| `repositories` | Tracked repos | Medium |
| `api_keys` | Programmatic access | Low |

### Telemetry (High Volume)

| Table | Purpose | Volume |
|-------|---------|--------|
| `code_events` | Raw webhook events | High (append-only) |
| `code_attribution` | AI detection results | High |
| `repo_metrics` | Pre-computed stats | Medium |
| `incidents` | Production issues | Low |

## Key Relationships

### Multi-Tenancy

All queries are scoped by `org_id`. The application layer enforces this:

```typescript
// Every query includes org context from authenticated user
const repos = await db.query.repositories.findMany({
  where: eq(repositories.orgId, user.orgId),
});
```

### GitHub Integration

```
github_installations.installation_id ← repositories.installation_id
```

We store `installation_id` (not the full installation record FK) on repositories because:
1. Webhooks include `installation.id`, enabling fast correlation
2. A repo always belongs to exactly one installation

### Attribution → Events

`code_attribution` and `code_events` share `commit_sha` but are not FK-linked:
- Events are raw telemetry (may include commits we haven't analyzed)
- Attribution is computed asynchronously
- Join via `commit_sha` when needed

## Index Rationale

### code_events

| Index | Purpose |
|-------|---------|
| `(repo_id, timestamp DESC)` | Dashboard: recent events per repo |
| `(commit_sha) WHERE NOT NULL` | Lookup specific commit |
| `(repo_id, event_type, timestamp)` | Filter by event type |

### code_attribution

| Index | Purpose |
|-------|---------|
| `(commit_sha, file_path) UNIQUE` | Dedup: one attribution per file |
| `(repo_id, ai_confidence DESC)` | Find high-confidence AI code |
| `(repo_id, risk_tier, created_at)` | Risk-based filtering |

### repo_metrics

| Index | Purpose |
|-------|---------|
| `(repo_id, date, period) UNIQUE` | One metric row per period |
| `(repo_id, date DESC)` | Dashboard time-series queries |

## Enums

All enums are defined at the database level for data integrity:

```sql
CREATE TYPE org_plan AS ENUM ('free', 'team', 'enterprise');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE event_type AS ENUM ('commit', 'pr_opened', 'pr_reviewed', 'pr_merged', 'deploy', 'incident');
CREATE TYPE detection_method AS ENUM ('heuristic', 'ml_model', 'manual_override');
CREATE TYPE risk_tier AS ENUM ('T1_boilerplate', 'T2_glue', 'T3_core', 'T4_novel');
CREATE TYPE time_period AS ENUM ('day', 'week', 'month');
CREATE TYPE incident_severity AS ENUM ('sev1', 'sev2', 'sev3', 'sev4');
CREATE TYPE incident_status AS ENUM ('investigating', 'identified', 'resolved');
CREATE TYPE github_account_type AS ENUM ('organization', 'user');
```

## Migration Workflow

### Development

```bash
# Push schema changes directly (dev only, destructive)
pnpm db:push

# Open Drizzle Studio to browse data
pnpm db:studio
```

### Production

```bash
# Generate migration from schema changes
pnpm db:generate

# Review generated SQL in ./drizzle/

# Apply migration
pnpm db:migrate
```

### Seeding

```bash
# Seed development database with test data
pnpm db:seed
```

## Connection Pooling

The database client (`src/server/db/client.ts`) configures connection pooling:

```typescript
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,              // Max connections in pool
  idleTimeoutMillis: 30000,  // Close idle connections after 30s
  connectionTimeoutMillis: 2000,  // Fail fast if can't connect
});
```

For serverless deployments (Vercel), consider using `@neondatabase/serverless` or connection poolers like PgBouncer.

## JSONB Columns

Several tables use JSONB for flexible storage:

| Table | Column | Contents |
|-------|--------|----------|
| `organizations` | `settings` | Feature flags, thresholds |
| `repositories` | `settings` | Per-repo config overrides |
| `code_events` | `metadata` | Event-specific payload |
| `code_attribution` | `detection_signals` | ML model outputs |
| `incidents` | `metadata` | External system data |

These are validated at the application layer using Zod schemas, not at the database level.

## Data Retention

| Table | Retention Policy |
|-------|------------------|
| `code_events` | Forever (valuable for trends) |
| `code_attribution` | Forever |
| `repo_metrics` | Forever (pre-aggregated, small) |
| `incidents` | Forever |

For high-volume tables, consider partitioning by `timestamp` if storage becomes an issue.
