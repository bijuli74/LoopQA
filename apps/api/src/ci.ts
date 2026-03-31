import type { IncomingMessage, ServerResponse } from "node:http";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { tests, testRuns, testSuites, agents, apiKeys } from "./db/schema.js";
import { validateApiKey, generateApiKey, hashKey } from "./auth.js";
import { sendToAgent } from "./ws.js";

// REST endpoints for CI/CD integration (not tRPC — standard REST for easy curl/webhook use)
export async function handleCIEndpoints(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");

  // POST /api/ci/trigger — trigger a test suite run
  if (req.method === "POST" && url.pathname === "/api/ci/trigger") {
    return handleTrigger(req, res);
  }

  // GET /api/ci/status/:runId — check run status
  if (req.method === "GET" && url.pathname.startsWith("/api/ci/status/")) {
    return handleStatus(req, res, url.pathname.split("/").pop()!);
  }

  // POST /api/ci/keys — create API key
  if (req.method === "POST" && url.pathname === "/api/ci/keys") {
    return handleCreateKey(req, res);
  }

  // POST /api/ci/webhook — GitHub/GitLab webhook receiver
  if (req.method === "POST" && url.pathname === "/api/ci/webhook") {
    return handleWebhook(req, res);
  }

  return false; // not handled
}

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON")); }
    });
  });
}

function json(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
  return true;
}

async function authenticate(req: IncomingMessage): Promise<{ projectId: string; scopes: string[] } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  return validateApiKey(authHeader.slice(7));
}

async function handleTrigger(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const auth = await authenticate(req);
  if (!auth) return json(res, 401, { error: "Invalid or missing API key" });

  const body = await readBody(req).catch(() => null);
  if (!body) return json(res, 400, { error: "Invalid JSON body" });

  const { suiteId, devicePairId, triggeredBy } = body;
  if (!suiteId) return json(res, 400, { error: "suiteId is required" });

  // Get all tests in suite
  const suiteTests = await db.select().from(tests)
    .where(eq(tests.suiteId, suiteId));

  if (suiteTests.length === 0) return json(res, 404, { error: "No tests in suite" });

  // Create runs for each test
  const runs = [];
  for (const test of suiteTests) {
    if (test.status !== "active") continue;

    const [run] = await db.insert(testRuns).values({
      testId: test.id,
      projectId: auth.projectId,
      triggeredBy: triggeredBy ?? "ci",
      triggerSource: "ci" as const,
      devicePairId: devicePairId ?? "00000000-0000-0000-0000-000000000003",
      status: "queued",
      stepResults: [],
      artifacts: [],
      healingSuggestions: [],
    }).returning();

    // Dispatch to agent
    const projectAgents = await db.select().from(agents).where(eq(agents.projectId, auth.projectId));
    const onlineAgent = projectAgents.find(a => a.status === "online");
    if (onlineAgent) {
      await db.update(testRuns).set({ status: "running", startedAt: new Date() }).where(eq(testRuns.id, run.id));
      sendToAgent(onlineAgent.id, "execute_test", {
        runId: run.id,
        deviceId: "auto",
        steps: test.steps,
      });
    }

    runs.push({ runId: run.id, testId: test.id, testName: test.name, status: run.status });
  }

  return json(res, 200, {
    message: `Triggered ${runs.length} test(s)`,
    runs,
    statusUrl: runs.map(r => `/api/ci/status/${r.runId}`),
  });
}

async function handleStatus(_req: IncomingMessage, res: ServerResponse, runId: string): Promise<boolean> {
  const [run] = await db.select().from(testRuns).where(eq(testRuns.id, runId));
  if (!run) return json(res, 404, { error: "Run not found" });

  return json(res, 200, {
    runId: run.id,
    status: run.status,
    durationMs: run.durationMs,
    failureClassification: run.failureClassification,
    stepResults: run.stepResults,
    completedAt: run.completedAt,
  });
}

async function handleCreateKey(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const body = await readBody(req).catch(() => null);
  if (!body?.projectId || !body?.name) return json(res, 400, { error: "projectId and name required" });

  const { key, prefix, hash } = generateApiKey();
  await db.insert(apiKeys).values({
    projectId: body.projectId,
    name: body.name,
    keyHash: hash,
    prefix,
    scopes: body.scopes ?? ["ci"],
  });

  return json(res, 200, {
    key, // only shown once
    prefix,
    message: "Save this key — it won't be shown again.",
  });
}

async function handleWebhook(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const auth = await authenticate(req);
  if (!auth) return json(res, 401, { error: "Invalid or missing API key" });

  const body = await readBody(req).catch(() => null);
  if (!body) return json(res, 400, { error: "Invalid JSON body" });

  // Detect GitHub push/PR events
  const ghEvent = req.headers["x-github-event"] as string;
  const glEvent = req.headers["x-gitlab-event"] as string;

  let trigger = false;
  let ref = "";

  if (ghEvent === "push") {
    ref = body.ref ?? "";
    trigger = ref === "refs/heads/main" || ref === "refs/heads/master";
  } else if (ghEvent === "pull_request" && body.action === "opened") {
    ref = body.pull_request?.head?.ref ?? "";
    trigger = true;
  } else if (glEvent === "Push Hook") {
    ref = body.ref ?? "";
    trigger = ref.includes("main") || ref.includes("master");
  }

  if (!trigger) {
    return json(res, 200, { message: "Event ignored", event: ghEvent || glEvent });
  }

  // Trigger all active suites for this project
  const suites = await db.select().from(testSuites).where(eq(testSuites.projectId, auth.projectId));
  const allRuns = [];

  for (const suite of suites) {
    const suiteTests = await db.select().from(tests).where(eq(tests.suiteId, suite.id));
    for (const test of suiteTests) {
      if (test.status !== "active") continue;
      const [run] = await db.insert(testRuns).values({
        testId: test.id,
        projectId: auth.projectId,
        triggeredBy: `webhook:${ref}`,
        triggerSource: "ci" as const,
        devicePairId: "00000000-0000-0000-0000-000000000003",
        status: "queued",
        stepResults: [],
        artifacts: [],
        healingSuggestions: [],
      }).returning();
      allRuns.push(run.id);
    }
  }

  return json(res, 200, {
    message: `Webhook received. Triggered ${allRuns.length} run(s).`,
    ref,
    runs: allRuns,
  });
}
