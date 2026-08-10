import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { reflections } from "@/server/db/schema";
import type { Period } from "@/lib/constants";

export async function listReflections(period?: Period) {
  return db
    .select()
    .from(reflections)
    .where(period ? eq(reflections.period, period) : undefined)
    .orderBy(desc(reflections.periodStart));
}

export async function getReflectionById(id: string) {
  const [row] = await db.select().from(reflections).where(eq(reflections.id, id));
  return row ?? null;
}

export type ReflectionInput = { period: Period; periodStart: string; body: string };

// periodStart is server-computed from a user-picked anchor date, not
// user-typed, so a second "create" for a date that normalizes into an
// already-covered period should update that entry's body in place rather
// than erroring on the unique constraint — onConflictDoUpdate, the "do
// update" sibling of checklist.ts's onConflictDoNothing.
export async function upsertReflection(input: ReflectionInput) {
  const [row] = await db
    .insert(reflections)
    .values(input)
    .onConflictDoUpdate({
      target: [reflections.period, reflections.periodStart],
      set: { body: input.body, updatedAt: new Date().toISOString() },
    })
    .returning();
  return row;
}

export async function updateReflectionBody(id: string, body: string) {
  await db
    .update(reflections)
    .set({ body, updatedAt: new Date().toISOString() })
    .where(eq(reflections.id, id));
}

// Real delete, not soft — unlike rules/setupTags/checklistItems, nothing
// references reflections historically, and no streak/badge/breakdown logic
// ever reads one. Mirrors deleteTrade's hard-delete precedent for
// user-authored content the user explicitly removes.
export async function deleteReflection(id: string) {
  await db.delete(reflections).where(eq(reflections.id, id));
}
