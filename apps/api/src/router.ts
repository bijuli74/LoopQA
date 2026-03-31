import { router } from "./trpc.js";
import { projectRouter } from "./routers/projects.js";
import { testRouter, suiteRouter } from "./routers/tests.js";
import { runRouter } from "./routers/runs.js";
import { deviceRouter } from "./routers/devices.js";
import { aiRouter } from "./routers/ai.js";
import { scheduleRouter } from "./routers/schedule.js";
import { statsRouter } from "./routers/stats.js";

export const appRouter = router({
  project: projectRouter,
  suite: suiteRouter,
  test: testRouter,
  run: runRouter,
  device: deviceRouter,
  ai: aiRouter,
  schedule: scheduleRouter,
  stats: statsRouter,
});

export type AppRouter = typeof appRouter;
