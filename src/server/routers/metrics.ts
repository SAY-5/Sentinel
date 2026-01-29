import { z } from "zod/v4";
import { eq, desc, gte, and, sql } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { repoMetrics, codeAttribution, incidents } from "../db/schema";

export const metricsRouter = router({
  getRepoOverview: publicProcedure
    .input(z.object({ repoId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { repoId } = input;

      const [latest] = await db
        .select()
        .from(repoMetrics)
        .where(
          and(eq(repoMetrics.repoId, repoId), eq(repoMetrics.period, "day"))
        )
        .orderBy(desc(repoMetrics.date))
        .limit(1);

      const [highRisk] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(codeAttribution)
        .where(
          and(
            eq(codeAttribution.repoId, repoId),
            sql`risk_tier IN ('T3_core', 'T4_novel')`
          )
        );

      const [openIncidents] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(incidents)
        .where(
          and(eq(incidents.repoId, repoId), sql`status != 'resolved'`)
        );

      return {
        aiCodePercentage: Number(latest?.aiCodePercentage ?? 0),
        verificationTaxHours: Number(latest?.verificationTaxHours ?? 0),
        highRiskFiles: highRisk?.count ?? 0,
        openIncidents: openIncidents?.count ?? 0,
        lastUpdated: latest?.computedAt ?? null,
      };
    }),

  getRepoMetrics: publicProcedure
    .input(
      z.object({
        repoId: z.string().uuid(),
        days: z.number().min(7).max(90).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { repoId, days } = input;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const metrics = await db
        .select({
          date: repoMetrics.date,
          aiCodePercentage: repoMetrics.aiCodePercentage,
          aiCommits: repoMetrics.aiCommits,
          humanCommits: repoMetrics.humanCommits,
          incidentCount: repoMetrics.incidentCount,
        })
        .from(repoMetrics)
        .where(
          and(
            eq(repoMetrics.repoId, repoId),
            eq(repoMetrics.period, "day"),
            gte(repoMetrics.date, cutoff.toISOString().split("T")[0])
          )
        )
        .orderBy(repoMetrics.date);

      return metrics.map((m) => ({
        date: m.date,
        aiCodePercentage: Number(m.aiCodePercentage),
        aiCommits: m.aiCommits,
        humanCommits: m.humanCommits,
        incidentCount: m.incidentCount,
      }));
    }),

  getHighRiskFiles: publicProcedure
    .input(
      z.object({
        repoId: z.string().uuid(),
        minScore: z.number().min(0).max(1).default(0.3),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { repoId, minScore, limit } = input;

      const files = await db
        .select({
          id: codeAttribution.id,
          filePath: codeAttribution.filePath,
          commitSha: codeAttribution.commitSha,
          aiConfidence: codeAttribution.aiConfidence,
          riskTier: codeAttribution.riskTier,
          riskScore: codeAttribution.riskScore,
          riskExplanation: codeAttribution.riskExplanation,
          linesAdded: codeAttribution.linesAdded,
          analyzedAt: codeAttribution.analyzedAt,
        })
        .from(codeAttribution)
        .where(
          and(
            eq(codeAttribution.repoId, repoId),
            gte(codeAttribution.riskScore, minScore.toString())
          )
        )
        .orderBy(desc(codeAttribution.riskScore))
        .limit(limit);

      return files.map((f) => ({
        ...f,
        aiConfidence: Number(f.aiConfidence),
        riskScore: Number(f.riskScore),
      }));
    }),
});
