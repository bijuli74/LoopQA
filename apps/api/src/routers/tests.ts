import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { tests, testSuites } from "../db/schema.js";

const testStepSchema = z.object({
  id: z.string(),
  order: z.number(),
  action: z.string(),
  target: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  assertion: z.string().optional(),
  timeoutMs: z.number().optional(),
});

export const testRouter = router({
  list: publicProcedure
    .input(z.object({ suiteId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.select().from(tests).where(eq(tests.suiteId, input.suiteId));
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [test] = await db.select().from(tests).where(eq(tests.id, input.id));
      return test ?? null;
    }),

  create: publicProcedure
    .input(z.object({
      suiteId: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().optional(),
      steps: z.array(testStepSchema),
      codeView: z.string(),
      nlSource: z.string().optional(),
      tags: z.array(z.string()).default([]),
    }))
    .mutation(async ({ input }) => {
      const [test] = await db.insert(tests).values({
        ...input,
        flakinessScore: 0,
        status: "active",
      }).returning();
      return test;
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      steps: z.array(testStepSchema).optional(),
      codeView: z.string().optional(),
      tags: z.array(z.string()).optional(),
      status: z.enum(["active", "quarantined", "archived"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const [test] = await db.update(tests)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tests.id, id))
        .returning();
      return test;
    }),
});

export const suiteRouter = router({
  list: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.select().from(testSuites).where(eq(testSuites.projectId, input.projectId));
    }),

  create: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [suite] = await db.insert(testSuites).values(input).returning();
      return suite;
    }),
});
