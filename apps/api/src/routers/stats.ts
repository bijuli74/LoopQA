import { z } from "zod";
import { eq, sql, and, gte, desc } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { testRuns, tests, agents, devicePairs } from "../db/schema.js";
import { getProjectFlakinessRate } from "../flakiness.js";

export const statsRouter = router({
  dashboard: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { projectId } = input;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Total runs
      const allRuns = await db.select({ status: testRuns.status, createdAt: testRuns.createdAt })
        .from(testRuns)
        .where(eq(testRuns.projectId, projectId));

      const totalRuns = allRuns.length;
      const runsToday = allRuns.filter(r => r.createdAt >= today).length;
      const passed = allRuns.filter(r => r.status === "passed").length;
      const failed = allRuns.filter(r => r.status === "failed").length;
      const passRate = totalRuns > 0 ? Math.round((passed / totalRuns) * 100) : 0;

      // Flakiness
      const flakinessRate = await getProjectFlakinessRate(projectId);

      // Active tests
      const activeTests = await db.select({ id: tests.id })
        .from(tests)
        .innerJoin(
          db.select({ id: sql`ts.id`.as("id") }).from(sql`test_suites ts`).where(sql`ts.project_id = ${projectId}`).as("suites"),
          sql`${tests.suiteId} = suites.id`
        );

      // Online agents
      const onlineAgents = await db.select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.projectId, projectId), eq(agents.status, "online")));

      // Device pairs
      const pairs = await db.select({ id: devicePairs.id })
        .from(devicePairs)
        .where(eq(devicePairs.projectId, projectId));

      return {
        totalRuns,
        runsToday,
        passed,
        failed,
        passRate,
        flakinessRate: Math.round(flakinessRate * 100),
        activeTests: activeTests.length,
        onlineAgents: onlineAgents.length,
        devicePairs: pairs.length,
      };
    }),
});
