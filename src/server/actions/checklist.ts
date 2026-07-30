"use server";

import { revalidatePath } from "next/cache";
import { checklistItemSchema } from "@/lib/validation";
import {
  addCompletion,
  archiveChecklistItem,
  createChecklistItem,
  removeCompletion,
  reorderChecklistItems,
  updateChecklistItemText,
} from "@/server/queries/checklist";

export async function createChecklistItemAction(formData: FormData) {
  const { text } = checklistItemSchema.parse({ text: formData.get("text") });
  await createChecklistItem(text);
  revalidatePath("/checklist");
}

export async function archiveChecklistItemAction(id: string) {
  await archiveChecklistItem(id);
  revalidatePath("/checklist");
}

export async function updateChecklistItemTextAction(id: string, text: string) {
  const parsed = checklistItemSchema.parse({ text });
  await updateChecklistItemText(id, parsed.text);
  revalidatePath("/checklist");
}

export async function reorderChecklistItemsAction(orderedIds: string[]) {
  await reorderChecklistItems(orderedIds);
  revalidatePath("/checklist");
}

export async function toggleChecklistCompletionAction(
  itemId: string,
  date: string,
  completed: boolean,
) {
  if (completed) {
    await addCompletion(itemId, date);
  } else {
    await removeCompletion(itemId, date);
  }
  revalidatePath("/checklist");
  revalidatePath("/");
}
