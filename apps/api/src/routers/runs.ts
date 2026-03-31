import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { testRuns, agents } from "../db/schema.js";
import { sendToAgent } from "../ws.js";

export const runRouter = router({
  list: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      return db.select()
        .from(testRuns)
        .where(eq(testRuns.projectId, input.projectId))
        .orderBy(desc(testRuns.createdAt))
        .limit(input.limit);
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [run] = await db.select().from(testRuns).where(eq(testRuns.id, input.id));
      return run ?? null;
    }),

  trigger: publicProcedure
    .input(z.object({
      testId: z.string().uuid(),
      projectId: z.string().uuid(),
      devicePairId: z.string().uuid(),
      triggeredBy: z.string(),
      triggerSource: z.enum(["manual", "ci", "schedule"]),
    }))
    .mutation(async ({ input }) => {
      const [run] = await db.insert(testRuns).values({
        ...input,
        status: "queued",
        stepResults: [],
        artifacts: [],
        healingSuggestions: [],
      }).returning();

      // Find an online agent for this project and dispatch
      const projectAgents = await db.select()
        .from(agents)
        .where(eq(agents.projectId, input.projectId));

      const onlineAgent = projectAgents.find(a => a.status === "online");
      if (onlineAgent) {
        // Get test steps
        const { tests } = await import("../db/schema.js");
        const [test] = await db.select().from(tests).where(eq(tests.id, input.testId));

        if (test) {
          await db.update(testRuns).set({ status: "running", startedAt: new Date() }).where(eq(testRuns.id, run.id));

          sendToAgent(onlineAgent.id, "execute_test", {
            runId: run.id,
            deviceId: "auto", // agent picks first available
            steps: test.steps,
          });
        }
      }

      return run;
    }),
});
