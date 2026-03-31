import http from "node:http";
import { createHTTPHandler } from "@trpc/server/adapters/standalone";
import { appRouter } from "./router.js";
import { startAgentWsServer, addSSEClient } from "./ws.js";
import { handleCIEndpoints } from "./ci.js";
import { handleExportEndpoints } from "./export.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const WS_PORT = parseInt(process.env.WS_PORT ?? "4001", 10);

const trpcHandler = createHTTPHandler({ router: appRouter });

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // SSE endpoint
  if (req.url === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const remove = addSSEClient(send);
    req.on("close", remove);
    return;
  }

  // CI/CD REST endpoints
  if (req.url?.startsWith("/api/ci/")) {
    const handled = await handleCIEndpoints(req, res);
    if (handled) return;
  }

  // Export endpoints
  if (req.url?.startsWith("/api/export/")) {
    const handled = await handleExportEndpoints(req, res);
    if (handled) return;
  }

  // tRPC
  trpcHandler(req, res);
});

server.listen(PORT, () => {
  console.log(`LoopQA API server listening on http://localhost:${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/events`);
  console.log(`CI/CD API: http://localhost:${PORT}/api/ci/*`);
});

startAgentWsServer(WS_PORT);
