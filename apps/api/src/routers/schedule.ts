import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { scheduledRuns } from "../db/schema.js";

export const scheduleRouter = router({
  list: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.select().from(scheduledRuns).where(eq(scheduledRuns.projectId, input.projectId));
    }),

  create: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      suiteId: z.string().uuid(),
      devicePairId: z.string().uuid(),
      cronExpression: z.string().min(5),
    }))
    .mutation(async ({ input }) => {
      const nextRun = getNextCronRun(input.cronExpression);
      const [schedule] = await db.insert(scheduledRuns).values({
        ...input,
        nextRunAt: nextRun,
      }).returning();
      return schedule;
    }),

  toggle: publicProcedure
    .input(z.object({ id: z.string().uuid(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const [schedule] = await db.update(scheduledRuns)
        .set({ enabled: input.enabled ? 1 : 0 })
        .where(eq(scheduledRuns.id, input.id))
        .returning();
      return schedule;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(scheduledRuns).where(eq(scheduledRuns.id, input.id));
      return { ok: true };
    }),
});

// Simple next-run calculator for common cron patterns
function getNextCronRun(cron: string): Date {
  const now = new Date();
  const next = new Date(now);

  // Handle simple patterns
  if (cron.includes("@hourly") || cron === "0 * * * *") {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  } else if (cron.includes("@daily") || cron === "0 0 * * *") {
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  } else if (cron.includes("@weekly")) {
    next.setDate(next.getDate() + (7 - next.getDay()));
    next.setHours(0, 0, 0, 0);
  } else {
    // Default: 1 hour from now
    next.setHours(next.getHours() + 1, 0, 0, 0);
  }

  return next;
}
