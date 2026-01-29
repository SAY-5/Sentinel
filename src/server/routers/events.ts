import { z } from "zod/v4";
import { eq, desc, and, lt } from "drizzle-orm";
import { router, publicProcedure } from "../trpc";
import { codeEvents } from "../db/schema";

export const eventsRouter = router({
  getCodeEvents: publicProcedure
    .input(
      z.object({
        repoId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().uuid().optional(),
        eventType: z
          .enum([
            "commit",
            "pr_opened",
            "pr_reviewed",
            "pr_merged",
            "deploy",
            "incident",
          ])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const { repoId, limit, cursor, eventType } = input;

      const conditions = [eq(codeEvents.repoId, repoId)];

      if (eventType) {
        conditions.push(eq(codeEvents.eventType, eventType));
      }

      if (cursor) {
        const cursorEvent = await db.query.codeEvents.findFirst({
          where: eq(codeEvents.id, cursor),
          columns: { timestamp: true },
        });
        if (cursorEvent) {
          conditions.push(lt(codeEvents.timestamp, cursorEvent.timestamp));
        }
      }

      const events = await db
        .select({
          id: codeEvents.id,
          eventType: codeEvents.eventType,
          timestamp: codeEvents.timestamp,
          commitSha: codeEvents.commitSha,
          prNumber: codeEvents.prNumber,
          authorLogin: codeEvents.authorLogin,
          metadata: codeEvents.metadata,
        })
        .from(codeEvents)
        .where(and(...conditions))
        .orderBy(desc(codeEvents.timestamp))
        .limit(limit + 1);

      const hasMore = events.length > limit;
      const items = hasMore ? events.slice(0, -1) : events;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return {
        items,
        nextCursor,
      };
    }),

  getEventById: publicProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { db } = ctx;

      const event = await db.query.codeEvents.findFirst({
        where: eq(codeEvents.id, input.eventId),
      });

      return event ?? null;
    }),
});
