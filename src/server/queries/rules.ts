import {
  moodTagsCollection,
  rulesCollection,
  setupTagsCollection,
  type MoodTag,
  type Rule,
  type SetupTag,
} from "@/server/firebase/collections";
import { nanoid } from "@/server/firebase/ids";
import { runBatch } from "@/server/firebase/batch";
import { DEFAULT_MOOD_TAGS, DEFAULT_RULES, DEFAULT_SETUP_TAGS } from "@/lib/constants";

async function allRulesSortedByOrder(): Promise<Rule[]> {
  const snapshot = await rulesCollection().orderBy("sortOrder", "asc").get();
  return snapshot.docs.map((doc) => doc.data());
}

export async function listActiveRules() {
  return (await allRulesSortedByOrder()).filter((r) => r.isActive && r.archivedAt === null);
}

export async function listAllRules() {
  return allRulesSortedByOrder();
}

export async function createRule(text: string): Promise<Rule> {
  const lastSnapshot = await rulesCollection().orderBy("sortOrder", "desc").limit(1).get();
  const maxSort = lastSnapshot.empty ? -1 : lastSnapshot.docs[0]!.data().sortOrder;
  const now = new Date().toISOString();
  const row: Rule = {
    id: nanoid(),
    text,
    sortOrder: maxSort + 1,
    isActive: true,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await rulesCollection().doc(row.id).set(row);
  return row;
}

export async function archiveRule(id: string) {
  await rulesCollection()
    .doc(id)
    .update({ isActive: false, archivedAt: new Date().toISOString() });
}

export async function updateRuleText(id: string, text: string) {
  await rulesCollection().doc(id).update({ text });
}

export async function reorderRules(orderedIds: string[]) {
  await runBatch((batch) => {
    orderedIds.forEach((id, index) => {
      batch.update(rulesCollection().doc(id), { sortOrder: index });
    });
  });
}

export async function listActiveSetupTags() {
  const snapshot = await setupTagsCollection().get();
  return snapshot.docs.map((doc) => doc.data()).filter((t) => t.isActive);
}

export async function createSetupTag(name: string): Promise<SetupTag> {
  const now = new Date().toISOString();
  const row: SetupTag = {
    id: nanoid(),
    name,
    notes: null,
    expectedR: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  await setupTagsCollection().doc(row.id).set(row);
  return row;
}

export async function archiveSetupTag(id: string) {
  await setupTagsCollection().doc(id).update({ isActive: false });
}

export async function getSetupTagById(id: string) {
  const doc = await setupTagsCollection().doc(id).get();
  return doc.exists ? doc.data()! : null;
}

// notes/expectedR only — name/isActive untouched, matching updateRuleText's
// scoped-field-update precedent.
export async function updateSetupTagDetails(
  id: string,
  details: { notes: string | null; expectedR: number | null },
) {
  await setupTagsCollection().doc(id).update(details);
}

export async function listActiveMoodTags() {
  const snapshot = await moodTagsCollection().get();
  return snapshot.docs.map((doc) => doc.data()).filter((t) => t.isActive);
}

export async function createMoodTag(
  name: string,
  category: "before" | "after" | "both",
): Promise<MoodTag> {
  const now = new Date().toISOString();
  const row: MoodTag = {
    id: nanoid(),
    name,
    category,
    notes: null,
    expectedR: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  await moodTagsCollection().doc(row.id).set(row);
  return row;
}

export async function archiveMoodTag(id: string) {
  await moodTagsCollection().doc(id).update({ isActive: false });
}

export async function getMoodTagById(id: string) {
  const doc = await moodTagsCollection().doc(id).get();
  return doc.exists ? doc.data()! : null;
}

// notes/expectedR only — mirrors updateSetupTagDetails's scoped-field-update.
export async function updateMoodTagDetails(
  id: string,
  details: { notes: string | null; expectedR: number | null },
) {
  await moodTagsCollection().doc(id).update(details);
}

/** Seeds example rules/tags on first run only — never overwrites existing data. */
export async function seedDefaultsIfEmpty() {
  const now = new Date().toISOString();

  const existingRules = await rulesCollection().limit(1).get();
  if (existingRules.empty) {
    await runBatch((batch) => {
      DEFAULT_RULES.forEach((text, i) => {
        const row: Rule = {
          id: nanoid(),
          text,
          sortOrder: i,
          isActive: true,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(rulesCollection().doc(row.id), row);
      });
    });
  }

  const existingSetupTags = await setupTagsCollection().limit(1).get();
  if (existingSetupTags.empty) {
    await runBatch((batch) => {
      DEFAULT_SETUP_TAGS.forEach((name) => {
        const row: SetupTag = {
          id: nanoid(),
          name,
          notes: null,
          expectedR: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(setupTagsCollection().doc(row.id), row);
      });
    });
  }

  const existingMoodTags = await moodTagsCollection().limit(1).get();
  if (existingMoodTags.empty) {
    await runBatch((batch) => {
      DEFAULT_MOOD_TAGS.forEach(({ name, category }) => {
        const row: MoodTag = {
          id: nanoid(),
          name,
          category,
          notes: null,
          expectedR: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        batch.set(moodTagsCollection().doc(row.id), row);
      });
    });
  }
}
