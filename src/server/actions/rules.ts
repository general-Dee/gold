"use server";

import { revalidatePath } from "next/cache";
import {
  archiveMoodTag,
  archiveRule,
  archiveSetupTag,
  createMoodTag,
  createRule,
  createSetupTag,
} from "@/server/queries/rules";
import { moodTagSchema, ruleSchema, setupTagSchema } from "@/lib/validation";

export async function createRuleAction(formData: FormData) {
  const { text } = ruleSchema.parse({ text: formData.get("text") });
  await createRule(text);
  revalidatePath("/rules");
}

export async function archiveRuleAction(id: string) {
  await archiveRule(id);
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
