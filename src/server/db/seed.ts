import { db, closePool } from "./client";
import {
  organizations,
  organizationMembers,
  githubInstallations,
  repositories,
  codeEvents,
  codeAttribution,
  incidents,
  apiKeys,
} from "./schema";
import { createHash, randomBytes } from "crypto";

const ACME_ORG_ID = "550e8400-e29b-41d4-a716-446655440000";
const INSTALLATION_ID = 12345678;
const REPO_BACKEND_ID = "550e8400-e29b-41d4-a716-446655440001";
const REPO_FRONTEND_ID = "550e8400-e29b-41d4-a716-446655440002";

function sha(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 40);
}

// Get date window in LA timezone
function getLADateWindow(daysAgo: number = 0): { dateStr: string; start: Date; end: Date } {
  const now = new Date();
  
  const laFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  
  const parts = laFormatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  
  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10);
  const day = parseInt(get("day"), 10);
  
  const targetDate = new Date(year, month - 1, day);
  targetDate.setDate(targetDate.getDate() - daysAgo);
  
  const dateStr = targetDate.toISOString().split("T")[0];
  
  // LA is UTC-8 (winter) or UTC-7 (summer DST)
  // Create timestamps that fall within the LA day
  const start = new Date(`${dateStr}T08:00:00.000Z`); // midnight LA = 8am UTC
  const end = new Date(`${dateStr}T15:59:59.999Z`);   // 8am LA = 4pm UTC
  
  return { dateStr, start, end };
}

function randomTime(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seed() {
  console.log("Seeding database...\n");

  // Clean existing data
  await db.delete(apiKeys);
  await db.delete(incidents);
  await db.delete(codeAttribution);
  await db.delete(codeEvents);
  await db.delete(repositories);
  await db.delete(githubInstallations);
  await db.delete(organizationMembers);
  await db.delete(organizations);

  // 1. Organization
  await db.insert(organizations).values({
    id: ACME_ORG_ID,
    name: "Acme Corp",
    slug: "acme-corp",
    plan: "team",
    settings: { alertThreshold: 0.8 },
  });
  console.log("✓ Organization");

  // 2. Members
  await db.insert(organizationMembers).values([
    { orgId: ACME_ORG_ID, userId: "user_2abc123def456", role: "owner" },
    { orgId: ACME_ORG_ID, userId: "user_2xyz789ghi012", role: "admin" },
  ]);
  console.log("✓ Members");

  // 3. GitHub installation
  await db.insert(githubInstallations).values({
    orgId: ACME_ORG_ID,
    installationId: INSTALLATION_ID,
    accountLogin: "acme-corp",
    accountType: "organization",
    installedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  });
  console.log("✓ GitHub installation");

  // 4. Repositories
  await db.insert(repositories).values([
    {
      id: REPO_BACKEND_ID,
      orgId: ACME_ORG_ID,
      installationId: INSTALLATION_ID,
      githubId: 987654321,
      owner: "acme-corp",
      name: "backend-api",
      defaultBranch: "main",
    },
    {
      id: REPO_FRONTEND_ID,
      orgId: ACME_ORG_ID,
      installationId: INSTALLATION_ID,
      githubId: 987654322,
      owner: "acme-corp",
      name: "web-dashboard",
      defaultBranch: "main",
    },
  ]);
  console.log("✓ Repositories");

  // 5. Generate events and attributions for the last 7 days
  // ALL data goes to BACKEND repo (which the dashboard displays)
  const authors = ["jsmith", "agarcia", "mchen", "kwilliams", "lbrown"];
  const filePaths = [
    "src/auth/jwt.ts",
    "src/api/users.ts",
    "src/api/payments.ts",
    "src/utils/helpers.ts",
    "src/components/Button.tsx",
    "src/hooks/useAuth.ts",
    "src/middleware/rateLimit.ts",
    "src/services/email.ts",
  ];
  const riskTiers = ["T1_boilerplate", "T2_glue", "T3_core", "T4_novel"] as const;

  interface EventRow {
    repoId: string;
    eventType: "commit" | "pr_opened" | "pr_reviewed" | "pr_merged" | "deploy";
    timestamp: Date;
    commitSha: string | null;
    prNumber: number | null;
    authorLogin: string;
    metadata: Record<string, unknown>;
  }

  interface AttrRow {
    repoId: string;
    commitSha: string;
    filePath: string;
    aiConfidence: string;
    detectionMethod: "heuristic" | "ml_model";
    detectionSignals: Record<string, unknown>;
    complexityCyclomatic: number;
    complexityCognitive: number;
    riskTier: typeof riskTiers[number];
    riskScore: string;
    riskExplanation: string;
    linesAdded: number;
    linesDeleted: number;
    analyzedAt: Date;
  }

  const events: EventRow[] = [];
  const attrs: AttrRow[] = [];

  console.log("\nGenerating data for last 7 days (LA timezone):");

  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    const day = getLADateWindow(daysAgo);
    const numCommits = 6 + Math.floor(Math.random() * 6); // 6-11 commits
    
    console.log(`  Day ${daysAgo} (${day.dateStr}): ${numCommits} commits`);
    
    for (let c = 0; c < numCommits; c++) {
      const commitSha = sha(`backend-day${daysAgo}-commit${c}`);
      const timestamp = randomTime(day.start, day.end);
      
      // Commit event
      events.push({
        repoId: REPO_BACKEND_ID,
        eventType: "commit",
        timestamp,
        commitSha,
        prNumber: null,
        authorLogin: authors[c % authors.length],
        metadata: { message: `Update ${filePaths[c % filePaths.length]}` },
      });
      
      // Attribution - 70% are AI (confidence > 0.5)
      const isAI = c % 10 < 7; // 0,1,2,3,4,5,6 = AI; 7,8,9 = human
      const aiConfidence = isAI
        ? 0.6 + Math.random() * 0.35  // 0.60 - 0.95
        : 0.15 + Math.random() * 0.30; // 0.15 - 0.45
      
      const filePath = filePaths[c % filePaths.length];
      const isSecurityFile = filePath.includes("auth") || filePath.includes("payment");
      
      attrs.push({
        repoId: REPO_BACKEND_ID,
        commitSha,
        filePath,
        aiConfidence: aiConfidence.toFixed(2),
        detectionMethod: c % 5 === 0 ? "ml_model" : "heuristic",
        detectionSignals: { patterns: ["structure_match"], scores: { syntax: 0.7 } },
        complexityCyclomatic: 5 + (c % 12),
        complexityCognitive: 3 + (c % 8),
        riskTier: isSecurityFile ? riskTiers[2 + (c % 2)] : riskTiers[c % 4],
        riskScore: (0.3 + Math.random() * 0.5).toFixed(2),
        riskExplanation: isSecurityFile ? "Security-sensitive code" : "Standard code",
        linesAdded: 15 + (c % 60),
        linesDeleted: c % 15,
        analyzedAt: timestamp,
      });
    }
    
    // PR numbering: older days have lower PR numbers
    // daysAgo=6 -> PR 200, daysAgo=0 -> PR 206
    const prNum = 200 + (6 - daysAgo);
    
    // Open a PR on this day
    events.push({
      repoId: REPO_BACKEND_ID,
      eventType: "pr_opened",
      timestamp: randomTime(day.start, day.end),
      commitSha: null,
      prNumber: prNum,
      authorLogin: authors[daysAgo % authors.length],
      metadata: { title: `Feature: PR #${prNum}` },
    });
    
    // Merge the PREVIOUS PR (which was opened on an earlier/older day)
    // daysAgo=6 is oldest, daysAgo=0 is newest
    // So on daysAgo=5, merge PR from daysAgo=6 (prNum-1)
    if (daysAgo < 6) {
      const prevPrNum = prNum - 1; // PR opened on older day
      
      events.push({
        repoId: REPO_BACKEND_ID,
        eventType: "pr_reviewed",
        timestamp: randomTime(day.start, day.end),
        commitSha: null,
        prNumber: prevPrNum,
        authorLogin: authors[(daysAgo + 2) % authors.length],
        metadata: { action: "approved" },
      });
      
      events.push({
        repoId: REPO_BACKEND_ID,
        eventType: "pr_merged",
        timestamp: randomTime(day.start, day.end),
        commitSha: null,
        prNumber: prevPrNum,
        authorLogin: authors[(daysAgo + 1) % authors.length],
        metadata: {},
      });
    }
  }

  await db.insert(codeEvents).values(events);
  console.log(`\n✓ ${events.length} code events`);

  await db.insert(codeAttribution).values(attrs);
  console.log(`✓ ${attrs.length} code attributions`);

  // 6. Incidents
  const yesterday = getLADateWindow(1);
  const threeDaysAgo = getLADateWindow(3);
  
  await db.insert(incidents).values([
    {
      repoId: REPO_BACKEND_ID,
      externalId: "INC-001",
      title: "Payment timeout in checkout",
      severity: "sev2",
      status: "resolved",
      detectedAt: threeDaysAgo.start,
      resolvedAt: threeDaysAgo.end,
      suspectedCommitSha: sha("backend-day3-commit0"),
      affectedFiles: ["src/api/payments.ts"],
      aiAttributed: true,
      rootCause: "AI-generated retry logic issue",
      metadata: {},
    },
    {
      repoId: REPO_BACKEND_ID,
      externalId: "INC-002",
      title: "Auth endpoint errors",
      severity: "sev3",
      status: "investigating",
      detectedAt: yesterday.start,
      suspectedCommitSha: sha("backend-day1-commit0"),
      affectedFiles: ["src/auth/jwt.ts"],
      aiAttributed: null,
      metadata: {},
    },
  ]);
  console.log("✓ 2 incidents");

  // 7. API key
  const rawKey = `stl_live_${randomBytes(24).toString("hex")}`;
  await db.insert(apiKeys).values({
    orgId: ACME_ORG_ID,
    name: "CI Pipeline",
    keyPrefix: rawKey.slice(0, 12),
    keyHash: createHash("sha256").update(rawKey).digest("hex"),
    scopes: ["events:write", "metrics:read"],
    lastUsedAt: new Date(),
  });
  console.log("✓ API key");
  console.log(`  Key: ${rawKey}`);

  console.log("\n========================================");
  console.log("Seed complete! Now run metrics compute:");
  console.log("========================================\n");
  
  const today = getLADateWindow(0);
  const weekAgo = getLADateWindow(6);
  console.log(`curl -X POST "http://localhost:3000/api/admin/metrics/compute?startDate=${weekAgo.dateStr}&endDate=${today.dateStr}" \\`);
  console.log(`  -H "X-Admin-Key: YOUR_KEY"\n`);
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => closePool());
