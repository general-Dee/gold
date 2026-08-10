"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { startOfIsoWeek, startOfMonth, localDateKey } from "@/lib/dates";
import { reflectionBodySchema, reflectionFormSchema } from "@/lib/validation";
import {
  deleteReflection,
  updateReflectionBody,
  upsertReflection,
} from "@/server/queries/reflections";

export async function createReflectionAction(formData: FormData) {
  const { period, anchorDate, body } = reflectionFormSchema.parse({
    period: formData.get("period"),
    anchorDate: formData.get("anchorDate"),
    body: formData.get("body"),
  });

  // anchorDate is a bare "YYYY-MM-DD" from <input type="date">. new Date(string)
  // parses date-only ISO strings as UTC midnight, which shifts to the previous
  // local day on negative-UTC-offset systems — parse the components directly
  // into a local Date instead (same pitfall calendar.ts's getMonthGrid avoids
  // by building dates from y/m/d rather than parsing a string).
  const [year, month, day] = anchorDate.split("-").map(Number);
  const anchor = new Date(year, month - 1, day);
  const periodStart = localDateKey(period === "weekly" ? startOfIsoWeek(anchor) : startOfMonth(anchor));

  const row = await upsertReflection({ period, periodStart, body });
  revalidatePath("/journal");
  redirect(`/journal/${row.id}/edit`);
}

export async function updateReflectionAction(id: string, formData: FormData) {
  const { body } = reflectionBodySchema.parse({ body: formData.get("body") });
  await updateReflectionBody(id, body);
  revalidatePath("/journal");
  redirect("/journal");
}

export async function deleteReflectionAction(id: string) {
  await deleteReflection(id);
  revalidatePath("/journal");
  redirect("/journal");
}
