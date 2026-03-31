import { WebSocketServer, WebSocket } from "ws";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { agents, testRuns } from "./db/schema.js";

interface ConnectedAgent {
  ws: WebSocket;
  agentId: string;
  projectId: string;
}

const connectedAgents = new Map<string, ConnectedAgent>();

// SSE clients for real-time dashboard updates
const sseClients = new Set<(event: string, data: unknown) => void>();

export function addSSEClient(send: (event: string, data: unknown) => void) {
  sseClients.add(send);
  return () => sseClients.delete(send);
}

function broadcast(event: string, data: unknown) {
  for (const send of sseClients) {
    send(event, data);
  }
}

export function getConnectedAgent(agentId: string) {
  return connectedAgents.get(agentId);
}

export function sendToAgent(agentId: string, type: string, payload: unknown) {
  const agent = connectedAgents.get(agentId);
  if (!agent) return false;
  agent.ws.send(JSON.stringify({ type, payload }));
  return true;
}

export function startAgentWsServer(port: number) {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const agentId = url.searchParams.get("agentId");
    const projectId = url.searchParams.get("projectId");

    if (!agentId || !projectId) {
      ws.close(4000, "Missing agentId or projectId");
      return;
    }

    connectedAgents.set(agentId, { ws, agentId, projectId });
    console.log(`Agent connected: ${agentId}`);

    db.update(agents)
      .set({ status: "online", lastHeartbeat: new Date() })
      .where(eq(agents.id, agentId))
      .then(() => {});

    broadcast("agent_status", { agentId, status: "online" });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleAgentMessage(agentId, msg);
      } catch {
        console.error("Invalid message from agent", agentId);
      }
    });

    ws.on("close", () => {
      connectedAgents.delete(agentId);
      db.update(agents)
        .set({ status: "offline" })
        .where(eq(agents.id, agentId))
        .then(() => {});
      broadcast("agent_status", { agentId, status: "offline" });
      console.log(`Agent disconnected: ${agentId}`);
    });
  });

  console.log(`Agent WebSocket server listening on port ${port}`);
  return wss;
}

async function handleAgentMessage(agentId: string, msg: { type: string; payload: Record<string, unknown> }) {
  switch (msg.type) {
    case "heartbeat":
      await db.update(agents)
        .set({ lastHeartbeat: new Date(), metadata: msg.payload })
        .where(eq(agents.id, agentId));
      break;

    case "test_result": {
      const p = msg.payload;
      const runId = p.runId as string;
      if (!runId) break;

      await db.update(testRuns)
        .set({
          status: p.status as any,
          completedAt: new Date(),
          durationMs: p.durationMs as number,
          stepResults: (p.stepResults ?? []) as any,
          bleSession: (p.bleSession ?? null) as any,
          failureClassification: (p.failureClassification as any) || null,
        })
        .where(eq(testRuns.id, runId));

      broadcast("run_completed", { runId, status: p.status });
      console.log(`Test run ${runId}: ${p.status}`);
      break;
    }

    case "step_result":
      broadcast("step_result", msg.payload);
      break;

    case "ble_packet":
      broadcast("ble_packet", msg.payload);
      break;

    case "ble_event":
      broadcast("ble_event", msg.payload);
      break;

    default:
      console.log(`Unknown message type from ${agentId}: ${msg.type}`);
  }
}
