import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { moodTags, rules, setupTags } from "@/server/db/schema";
import { DEFAULT_MOOD_TAGS, DEFAULT_RULES, DEFAULT_SETUP_TAGS } from "@/lib/constants";

export async function listActiveRules() {
  return db
    .select()
    .from(rules)
    .where(and(eq(rules.isActive, true), isNull(rules.archivedAt)))
    .orderBy(asc(rules.sortOrder));
}

export async function listAllRules() {
  return db.select().from(rules).orderBy(asc(rules.sortOrder));
}

export async function createRule(text: string) {
  const existing = await db.select().from(rules);
  const maxSort = existing.reduce((max, r) => Math.max(max, r.sortOrder), -1);
  const [row] = await db
    .insert(rules)
    .values({ text, sortOrder: maxSort + 1 })
    .returning();
  return row;
}

export async function archiveRule(id: string) {
  await db
    .update(rules)
    .set({ isActive: false, archivedAt: new Date().toISOString() })
    .where(eq(rules.id, id));
}

export async function listActiveSetupTags() {
  return db.select().from(setupTags).where(eq(setupTags.isActive, true));
}

export async function createSetupTag(name: string) {
  const [row] = await db.insert(setupTags).values({ name }).returning();
  return row;
}

export async function archiveSetupTag(id: string) {
  await db.update(setupTags).set({ isActive: false }).where(eq(setupTags.id, id));
}

export async function listActiveMoodTags() {
  return db.select().from(moodTags).where(eq(moodTags.isActive, true));
}

export async function createMoodTag(name: string, category: "before" | "after" | "both") {
  const [row] = await db.insert(moodTags).values({ name, category }).returning();
  return row;
}

export async function archiveMoodTag(id: string) {
  await db.update(moodTags).set({ isActive: false }).where(eq(moodTags.id, id));
}

/** Seeds example rules/tags on first run only — never overwrites existing data. */
export async function seedDefaultsIfEmpty() {
  const existingRules = await db.select().from(rules).limit(1);
  if (existingRules.length === 0) {
    await db
      .insert(rules)
      .values(DEFAULT_RULES.map((text, i) => ({ text, sortOrder: i })));
  }

  const existingSetupTags = await db.select().from(setupTags).limit(1);
  if (existingSetupTags.length === 0) {
    await db.insert(setupTags).values(DEFAULT_SETUP_TAGS.map((name) => ({ name })));
  }

  const existingMoodTags = await db.select().from(moodTags).limit(1);
  if (existingMoodTags.length === 0) {
    await db.insert(moodTags).values(DEFAULT_MOOD_TAGS);
  }
}
