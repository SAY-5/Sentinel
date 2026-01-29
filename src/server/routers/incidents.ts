import { z } from "zod/v4";
import { eq, desc, and } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { incidents, codeAttribution } from "../db/schema";

export const incidentsRouter = router({
  getIncidents: publicProcedure
    .input(
      z.object({
        repoId: z.string().uuid(),
        status: z.enum(["investigating", "identified", "resolved"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { repoId, status } = input;

      const conditions = [eq(incidents.repoId, repoId)];
      if (status) {
        conditions.push(eq(incidents.status, status));
      }

      const items = await db
        .select({
          id: incidents.id,
          title: incidents.title,
          severity: incidents.severity,
          status: incidents.status,
          detectedAt: incidents.detectedAt,
          resolvedAt: incidents.resolvedAt,
          suspectedCommitSha: incidents.suspectedCommitSha,
          affectedFiles: incidents.affectedFiles,
          aiAttributed: incidents.aiAttributed,
        })
        .from(incidents)
        .where(and(...conditions))
        .orderBy(desc(incidents.detectedAt));

      return items;
    }),

  getIncidentById: publicProcedure
    .input(z.object({ incidentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const incident = await db.query.incidents.findFirst({
        where: eq(incidents.id, input.incidentId),
      });

      if (!incident) return null;

      let attribution = null;
      if (incident.suspectedCommitSha) {
        attribution = await db.query.codeAttribution.findFirst({
          where: eq(codeAttribution.commitSha, incident.suspectedCommitSha),
        });
      }

      return {
        ...incident,
        attribution: attribution
          ? {
              aiConfidence: Number(attribution.aiConfidence),
              riskTier: attribution.riskTier,
              riskScore: Number(attribution.riskScore),
              riskExplanation: attribution.riskExplanation,
            }
          : null,
      };
    }),
});
