import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { projects, organizations } from "../db/schema.js";

export const projectRouter = router({
  list: publicProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.select().from(projects).where(eq(projects.orgId, input.orgId));
    }),

  create: publicProcedure
    .input(z.object({
      orgId: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [project] = await db.insert(projects).values(input).returning();
      return project;
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [project] = await db.select().from(projects).where(eq(projects.id, input.id));
      return project ?? null;
    }),
});
