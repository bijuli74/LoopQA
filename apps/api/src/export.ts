import type { IncomingMessage, ServerResponse } from "node:http";
import { eq, desc } from "drizzle-orm";
import { db } from "./db/index.js";
import { testRuns, tests } from "./db/schema.js";

export async function handleExportEndpoints(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/api/export/csv") {
    return handleCSVExport(url, res);
  }

  if (req.method === "GET" && url.pathname === "/api/export/report") {
    return handleReportExport(url, res);
  }

  return false;
}

async function handleCSVExport(url: URL, res: ServerResponse): Promise<boolean> {
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "projectId required" }));
    return true;
  }

  const runs = await db.select().from(testRuns)
    .where(eq(testRuns.projectId, projectId))
    .orderBy(desc(testRuns.createdAt))
    .limit(500);

  const header = "Run ID,Test ID,Status,Duration (ms),Failure,Trigger,Created At\n";
  const rows = runs.map(r =>
    `${r.id},${r.testId},${r.status},${r.durationMs ?? ""},${r.failureClassification ?? ""},${r.triggerSource},${r.createdAt.toISOString()}`
  ).join("\n");

  res.writeHead(200, {
    "Content-Type": "text/csv",
    "Content-Disposition": `attachment; filename="loopqa-runs-${new Date().toISOString().slice(0, 10)}.csv"`,
  });
  res.end(header + rows);
  return true;
}

async function handleReportExport(url: URL, res: ServerResponse): Promise<boolean> {
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "projectId required" }));
    return true;
  }

  const runs = await db.select().from(testRuns)
    .where(eq(testRuns.projectId, projectId))
    .orderBy(desc(testRuns.createdAt))
    .limit(100);

  const total = runs.length;
  const passed = runs.filter(r => r.status === "passed").length;
  const failed = runs.filter(r => r.status === "failed").length;
  const avgDuration = total > 0
    ? Math.round(runs.filter(r => r.durationMs).reduce((a, r) => a + (r.durationMs ?? 0), 0) / total)
    : 0;

  const failures: Record<string, number> = {};
  runs.filter(r => r.failureClassification).forEach(r => {
    failures[r.failureClassification!] = (failures[r.failureClassification!] || 0) + 1;
  });

  const report = {
    title: "LoopQA Test Report",
    generatedAt: new Date().toISOString(),
    projectId,
    summary: {
      totalRuns: total,
      passed,
      failed,
      errored: runs.filter(r => r.status === "errored").length,
      passRate: total > 0 ? `${Math.round((passed / total) * 100)}%` : "N/A",
      avgDurationMs: avgDuration,
    },
    failureBreakdown: failures,
    recentRuns: runs.slice(0, 20).map(r => ({
      id: r.id,
      status: r.status,
      durationMs: r.durationMs,
      failure: r.failureClassification,
      trigger: r.triggerSource,
      createdAt: r.createdAt,
    })),
  };

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(report, null, 2));
  return true;
}
