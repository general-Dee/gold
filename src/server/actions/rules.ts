"use server";

import { revalidatePath } from "next/cache";
import {
  archiveMoodTag,
  archiveRule,
  archiveSetupTag,
  createMoodTag,
  createRule,
  createSetupTag,
  reorderRules,
  updateRuleText,
  updateSetupTagDetails,
} from "@/server/queries/rules";
import { moodTagSchema, ruleSchema, setupTagDetailsSchema, setupTagSchema } from "@/lib/validation";

const emptyToNull = (v: FormDataEntryValue | null) => (v === "" || v == null ? null : v);

export async function createRuleAction(formData: FormData) {
  const { text } = ruleSchema.parse({ text: formData.get("text") });
  await createRule(text);
  revalidatePath("/rules");
}

export async function archiveRuleAction(id: string) {
  await archiveRule(id);
  revalidatePath("/rules");
}

export async function updateRuleTextAction(id: string, text: string) {
  const parsed = ruleSchema.parse({ text });
  await updateRuleText(id, parsed.text);
  revalidatePath("/rules");
}

export async function reorderRulesAction(orderedIds: string[]) {
  await reorderRules(orderedIds);
  revalidatePath("/rules");
}

export async function createSetupTagAction(formData: FormData) {
  const { name } = setupTagSchema.parse({ name: formData.get("name") });
  await createSetupTag(name);
  revalidatePath("/rules");
}

export async function archiveSetupTagAction(id: string) {
  await archiveSetupTag(id);
  revalidatePath("/rules");
}

export async function updateSetupTagDetailsAction(id: string, formData: FormData) {
  const { notes, expectedR } = setupTagDetailsSchema.parse({
    notes: emptyToNull(formData.get("notes")),
    expectedR: emptyToNull(formData.get("expectedR")),
  });
  await updateSetupTagDetails(id, { notes: notes ?? null, expectedR: expectedR ?? null });
  revalidatePath("/rules");
  revalidatePath(`/setups/${id}`);
}

export async function createMoodTagAction(formData: FormData) {
  const { name, category } = moodTagSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
  });
  await createMoodTag(name, category);
  revalidatePath("/rules");
}

export async function archiveMoodTagAction(id: string) {
  await archiveMoodTag(id);
  revalidatePath("/rules");
}
