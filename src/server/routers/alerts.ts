import { z } from "zod";
import { eq, and, gte, desc, count, sql } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { alerts } from "../db/schema";

export const alertsRouter = router({
  getAlerts: publicProcedure
    .input(
      z.object({
        repoId: z.string().uuid(),
        severity: z.enum(["info", "warning", "critical"]).optional(),
        acknowledged: z.boolean().optional(),
        days: z.number().min(1).max(365).default(30),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const conditions = [
        eq(alerts.repoId, input.repoId),
        gte(alerts.triggeredAt, startDate),
      ];

      if (input.severity) {
        conditions.push(eq(alerts.severity, input.severity));
      }

      if (input.acknowledged === true) {
        conditions.push(sql`${alerts.acknowledgedAt} IS NOT NULL`);
      } else if (input.acknowledged === false) {
        conditions.push(sql`${alerts.acknowledgedAt} IS NULL`);
      }

      const rows = await ctx.db
        .select()
        .from(alerts)
        .where(and(...conditions))
        .orderBy(desc(alerts.triggeredAt))
        .limit(input.limit);

      return rows;
    }),

  getSummary: publicProcedure
    .input(z.object({ repoId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [totalRow] = await ctx.db
        .select({ count: count() })
        .from(alerts)
        .where(
          and(
            eq(alerts.repoId, input.repoId),
            gte(alerts.triggeredAt, thirtyDaysAgo)
          )
        );

      const [criticalRow] = await ctx.db
        .select({ count: count() })
        .from(alerts)
        .where(
          and(
            eq(alerts.repoId, input.repoId),
            eq(alerts.severity, "critical"),
            gte(alerts.triggeredAt, thirtyDaysAgo)
          )
        );

      const [unacknowledgedRow] = await ctx.db
        .select({ count: count() })
        .from(alerts)
        .where(
          and(
            eq(alerts.repoId, input.repoId),
            sql`${alerts.acknowledgedAt} IS NULL`,
            gte(alerts.triggeredAt, thirtyDaysAgo)
          )
        );

      const [mostRecent] = await ctx.db
        .select()
        .from(alerts)
        .where(eq(alerts.repoId, input.repoId))
        .orderBy(desc(alerts.triggeredAt))
        .limit(1);

      return {
        total: totalRow?.count ?? 0,
        critical: criticalRow?.count ?? 0,
        unacknowledged: unacknowledgedRow?.count ?? 0,
        mostRecent: mostRecent ?? null,
      };
    }),

  acknowledge: publicProcedure
    .input(
      z.object({
        alertId: z.string().uuid(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(alerts)
        .set({
          acknowledgedAt: new Date(),
          acknowledgedBy: input.userId,
        })
        .where(eq(alerts.id, input.alertId))
        .returning();

      return updated;
    }),
});
