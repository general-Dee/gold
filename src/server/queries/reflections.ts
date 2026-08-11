import { reflectionsCollection, type Reflection } from "@/server/firebase/collections";
import { reflectionId } from "@/server/firebase/ids";
import type { Period } from "@/lib/constants";

export async function listReflections(period?: Period) {
  const snapshot = await reflectionsCollection().orderBy("periodStart", "desc").get();
  const rows = snapshot.docs.map((doc) => doc.data());
  return period ? rows.filter((row) => row.period === period) : rows;
}

export async function getReflectionById(id: string) {
  const doc = await reflectionsCollection().doc(id).get();
  return doc.exists ? doc.data()! : null;
}

export type ReflectionInput = { period: Period; periodStart: string; body: string };

// periodStart is server-computed from a user-picked anchor date, not
// user-typed, so a second "create" for a date that normalizes into an
// already-covered period should update that entry's body in place rather
// than creating a duplicate. The (period, periodStart) pair is the document
// ID itself, so this is a plain overwrite rather than an onConflictDoUpdate.
export async function upsertReflection(input: ReflectionInput): Promise<Reflection> {
  const id = reflectionId(input.period, input.periodStart);
  const ref = reflectionsCollection().doc(id);
  const existing = await ref.get();
  const now = new Date().toISOString();
  const row: Reflection = existing.exists
    ? { ...existing.data()!, body: input.body, updatedAt: now }
    : {
        id,
        period: input.period,
        periodStart: input.periodStart,
        body: input.body,
        createdAt: now,
        updatedAt: now,
      };
  await ref.set(row);
  return row;
}

export async function updateReflectionBody(id: string, body: string) {
  await reflectionsCollection()
    .doc(id)
    .update({ body, updatedAt: new Date().toISOString() });
}

// Real delete, not soft — unlike rules/setupTags/checklistItems, nothing
// references reflections historically, and no streak/badge/breakdown logic
// ever reads one. Mirrors deleteTrade's hard-delete precedent for
// user-authored content the user explicitly removes.
export async function deleteReflection(id: string) {
  await reflectionsCollection().doc(id).delete();
}
