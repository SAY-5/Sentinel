# API Reference

Sentinel exposes a tRPC API for the dashboard and REST endpoints for webhooks and admin operations.

## tRPC API

Base URL: `/api/trpc`

All procedures use superjson for serialization (handles Dates, BigInts, etc.).

### metrics

Dashboard data for repository overview.

#### getRepoOverview

Returns summary metrics for the dashboard cards.

```typescript
// Input
{ repoId: string }

// Output
{
  aiCodePercentage: number,      // 0-100
  verificationTaxHours: number,  // Hours spent reviewing AI code
  highRiskFiles: number,         // Count of T3/T4 files
  openIncidents: number          // Unresolved incidents
}
```

#### getRepoMetrics

Returns time-series data for charts.

```typescript
// Input
{
  repoId: string,
  days?: number  // Default: 30
}

// Output
Array<{
  date: string,           // YYYY-MM-DD
  aiCodePercentage: number,
  totalCommits: number,
  aiCommits: number,
  humanCommits: number,
  avgReviewTimeMins: number,
  verificationTaxHours: number
}>
```

#### getHighRiskFiles

Returns files with elevated risk scores.

```typescript
// Input
{
  repoId: string,
  minRiskScore?: number,  // Default: 0.5
  limit?: number          // Default: 50
}

// Output
Array<{
  filePath: string,
  riskTier: 'T1_boilerplate' | 'T2_glue' | 'T3_core' | 'T4_novel',
  riskScore: number,
  aiConfidence: number,
  commitSha: string,
  analyzedAt: Date
}>
```

### events

Code event history from GitHub webhooks.

#### getCodeEvents

Paginated event feed.

```typescript
// Input
{
  repoId: string,
  limit?: number,   // Default: 50, max: 100
  cursor?: string   // Event ID for pagination
}

// Output
{
  events: Array<{
    id: string,
    eventType: 'commit' | 'pr_opened' | 'pr_reviewed' | 'pr_merged' | 'deploy',
    timestamp: Date,
    commitSha: string | null,
    prNumber: number | null,
    authorLogin: string,
    metadata: Record<string, unknown>
  }>,
  nextCursor: string | null
}
```

#### getEventById

Single event with full details.

```typescript
// Input
{ eventId: string }

// Output
{
  id: string,
  repoId: string,
  eventType: string,
  timestamp: Date,
  commitSha: string | null,
  prNumber: number | null,
  authorLogin: string,
  metadata: Record<string, unknown>,
  createdAt: Date
}
```

### incidents

Production incident tracking.

#### getIncidents

List incidents for a repository.

```typescript
// Input
{
  repoId: string,
  status?: 'investigating' | 'identified' | 'resolved'
}

// Output
Array<{
  id: string,
  title: string,
  severity: 'sev1' | 'sev2' | 'sev3' | 'sev4',
  status: string,
  detectedAt: Date,
  resolvedAt: Date | null,
  suspectedCommitSha: string | null,
  aiAttributed: boolean | null
}>
```

#### getIncidentById

Single incident with attribution details.

```typescript
// Input
{
  incidentId: string,
  includeAttribution?: boolean  // Default: false
}

// Output
{
  id: string,
  repoId: string,
  title: string,
  severity: string,
  status: string,
  detectedAt: Date,
  resolvedAt: Date | null,
  suspectedCommitSha: string | null,
  affectedFiles: string[],
  aiAttributed: boolean | null,
  rootCause: string | null,
  metadata: Record<string, unknown>,
  // When includeAttribution is true:
  attribution?: {
    aiConfidence: number,
    riskTier: string,
    detectionSignals: Record<string, unknown>
  }
}
```

### alerts

Alert history and acknowledgment.

#### getAlerts

Filtered alert list.

```typescript
// Input
{
  repoId: string,
  severity?: 'info' | 'warning' | 'critical',
  acknowledged?: boolean,
  days?: number,    // Default: 30
  limit?: number    // Default: 50
}

// Output
Array<{
  id: string,
  ruleName: string,
  severity: string,
  title: string,
  message: string,
  metricValue: string,
  threshold: string,
  channels: string[],
  triggeredAt: Date,
  sentAt: Date | null,
  acknowledgedAt: Date | null,
  acknowledgedBy: string | null
}>
```

#### getSummary

Alert counts for summary cards.

```typescript
// Input
{ repoId: string }

// Output
{
  total: number,           // Last 30 days
  critical: number,        // Critical severity count
  unacknowledged: number,  // Not yet acknowledged
  mostRecent: {
    title: string,
    triggeredAt: Date,
    severity: string
  } | null
}
```

#### acknowledge

Mark an alert as seen.

```typescript
// Input
{
  alertId: string,
  userId: string    // Clerk user ID
}

// Output
{
  id: string,
  acknowledgedAt: Date,
  acknowledgedBy: string
}
```

---

## REST Endpoints

### Webhooks

#### POST /api/webhooks/github

Receives GitHub webhook events.

**Headers:**
- `X-GitHub-Event` — Event type (push, pull_request, etc.)
- `X-GitHub-Delivery` — Unique delivery ID
- `X-Hub-Signature-256` — HMAC signature for verification

**Response:** `200 OK` with `{ received: true }`

The handler validates the signature, checks if the repository is tracked, and queues a job for async processing. Always responds quickly to avoid GitHub timeouts.

### Admin API

All admin endpoints require the `X-Admin-Key` header.

#### POST /api/admin/metrics/compute

Triggers metrics computation.

**Query Parameters:**
- `date` — Single date (YYYY-MM-DD)
- `startDate` + `endDate` — Date range for backfill
- `repoId` — Specific repository (optional, defaults to all active repos)

**Examples:**

```bash
# Yesterday (default)
curl -X POST "http://localhost:3000/api/admin/metrics/compute" \
  -H "X-Admin-Key: your-key"

# Specific date
curl -X POST "http://localhost:3000/api/admin/metrics/compute?date=2026-01-15" \
  -H "X-Admin-Key: your-key"

# Backfill range
curl -X POST "http://localhost:3000/api/admin/metrics/compute?startDate=2026-01-01&endDate=2026-01-31" \
  -H "X-Admin-Key: your-key"
```

**Response:**
```json
{
  "success": true,
  "processed": 7,
  "skipped": 0
}
```

#### POST /api/admin/metrics/survival

Triggers weekly code survival analysis.

```bash
curl -X POST "http://localhost:3000/api/admin/metrics/survival" \
  -H "X-Admin-Key: your-key"
```

#### POST /api/admin/metrics/saturation

Triggers review saturation check.

```bash
curl -X POST "http://localhost:3000/api/admin/metrics/saturation" \
  -H "X-Admin-Key: your-key"
```

### Alerts

#### POST /api/alerts/:id/acknowledge

Acknowledges an alert (called from dashboard).

**Response:**
```json
{
  "success": true,
  "alert": { ... }
}
```

---

## Error Handling

### tRPC Errors

tRPC procedures throw typed errors:

```typescript
throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Repository not found'
});
```

Common codes:
- `BAD_REQUEST` — Invalid input
- `NOT_FOUND` — Resource doesn't exist
- `UNAUTHORIZED` — Missing or invalid auth (future)
- `INTERNAL_SERVER_ERROR` — Something broke

### REST Errors

REST endpoints return JSON with appropriate status codes:

```json
{
  "error": "Description of what went wrong"
}
```

Status codes:
- `400` — Bad request (missing params, invalid format)
- `401` — Unauthorized (missing/invalid admin key)
- `404` — Not found
- `500` — Internal error

---

## Rate Limits

Currently no rate limits are enforced. When needed:

- Admin API: 60 requests/minute
- tRPC queries: 1000 requests/minute per IP
- Webhook handler: No limit (GitHub handles this)

---

## Pagination

List endpoints use cursor-based pagination:

```typescript
// First page
const { events, nextCursor } = await trpc.events.getCodeEvents({
  repoId: '...',
  limit: 50
});

// Next page
const page2 = await trpc.events.getCodeEvents({
  repoId: '...',
  limit: 50,
  cursor: nextCursor
});
```

When `nextCursor` is `null`, there are no more results.
