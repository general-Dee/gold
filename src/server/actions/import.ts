"use server";

import { revalidatePath } from "next/cache";
import { importTradesFromCsv, type ImportResult } from "@/server/queries/trades";

export type { ImportResult };

export async function importTradesAction(formData: FormData): Promise<ImportResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file selected.");
  }

  const text = await file.text();
  const result = await importTradesFromCsv(text);

  if (result.importedCount > 0) {
    revalidatePath("/trades");
    revalidatePath("/");
  }

  return result;
}
