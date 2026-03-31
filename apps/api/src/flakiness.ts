import { eq, sql, and } from "drizzle-orm";
import { db } from "./db/index.js";
import { tests, testRuns } from "./db/schema.js";

// Runs after every test completion. Updates flakiness scores and quarantines flaky tests.
export async function updateFlakinessScores(testId: string) {
  // Get last 10 runs for this test
  const recentRuns = await db.select({ status: testRuns.status })
    .from(testRuns)
    .where(eq(testRuns.testId, testId))
    .orderBy(sql`${testRuns.createdAt} DESC`)
    .limit(10);

  if (recentRuns.length < 3) return; // not enough data

  // Flakiness = ratio of status changes between consecutive runs
  let flips = 0;
  for (let i = 1; i < recentRuns.length; i++) {
    if (recentRuns[i].status !== recentRuns[i - 1].status) flips++;
  }
  const score = flips / (recentRuns.length - 1);

  // Update test
  const updates: Record<string, unknown> = {
    flakinessScore: Math.round(score * 100) / 100,
    updatedAt: new Date(),
  };

  // Auto-quarantine if flakiness > 30%
  if (score > 0.3) {
    const [test] = await db.select({ status: tests.status }).from(tests).where(eq(tests.id, testId));
    if (test?.status === "active") {
      updates.status = "quarantined";
      console.log(`Test ${testId} quarantined (flakiness: ${(score * 100).toFixed(0)}%)`);
    }
  }

  await db.update(tests).set(updates as any).where(eq(tests.id, testId));
}

// Global flakiness rate across all tests in a project
export async function getProjectFlakinessRate(projectId: string): Promise<number> {
  const recent = await db.select({
    status: testRuns.status,
    testId: testRuns.testId,
  })
    .from(testRuns)
    .where(eq(testRuns.projectId, projectId))
    .orderBy(sql`${testRuns.createdAt} DESC`)
    .limit(200);

  if (recent.length < 5) return 0;

  // Group by test, count flips
  const byTest = new Map<string, string[]>();
  for (const r of recent) {
    const arr = byTest.get(r.testId) ?? [];
    arr.push(r.status);
    byTest.set(r.testId, arr);
  }

  let totalFlips = 0;
  let totalPairs = 0;
  for (const statuses of byTest.values()) {
    for (let i = 1; i < statuses.length; i++) {
      if (statuses[i] !== statuses[i - 1]) totalFlips++;
      totalPairs++;
    }
  }

  return totalPairs > 0 ? totalFlips / totalPairs : 0;
}
