import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import { apiKeys } from "./db/schema.js";

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `lq_${randomBytes(24).toString("hex")}`;
  return { key, prefix: key.slice(0, 11), hash: hashKey(key) };
}

export async function validateApiKey(key: string): Promise<{ projectId: string; scopes: string[] } | null> {
  const hash = hashKey(key);
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, hash));
  if (!row) return null;

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return { projectId: row.projectId, scopes: row.scopes };
}
