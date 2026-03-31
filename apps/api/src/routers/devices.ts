import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { devices, devicePairs, agents } from "../db/schema.js";

export const deviceRouter = router({
  listDevices: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.select().from(devices).where(eq(devices.projectId, input.projectId));
    }),

  createDevice: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1),
      model: z.string().min(1),
      os: z.enum(["android", "ios", "wear_os", "watchos", "rtos"]),
      osVersion: z.string(),
      connectionType: z.enum(["usb", "wifi", "simulator", "emulator"]),
    }))
    .mutation(async ({ input }) => {
      const [device] = await db.insert(devices).values(input).returning();
      return device;
    }),

  listPairs: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.select().from(devicePairs).where(eq(devicePairs.projectId, input.projectId));
    }),

  createPair: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1),
      watchId: z.string().uuid(),
      phoneId: z.string().uuid(),
    }))
    .mutation(async ({ input }) => {
      const [pair] = await db.insert(devicePairs).values(input).returning();
      return pair;
    }),

  listAgents: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.select().from(agents).where(eq(agents.projectId, input.projectId));
    }),
});
