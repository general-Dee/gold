"use server";

import { revalidatePath } from "next/cache";
import {
  addAccountTransaction,
  deleteAccountTransaction,
  updateAccountSettings,
} from "@/server/queries/account";
import { accountSettingsSchema, accountTransactionSchema } from "@/lib/validation";

/** Empty string -> null — used for the optional goal fields, so they parse as
 * unset rather than coercing "" to 0. */
const emptyToNull = (v: FormDataEntryValue | null) => (v === "" || v == null ? null : v);

export async function updateAccountSettingsAction(formData: FormData) {
  const input = accountSettingsSchema.parse({
    startingBalance: formData.get("startingBalance"),
    monthlyProfitTargetPct: emptyToNull(formData.get("monthlyProfitTargetPct")),
    maxDrawdownLimitPct: emptyToNull(formData.get("maxDrawdownLimitPct")),
  });
  await updateAccountSettings(input);
  revalidatePath("/account");
  revalidatePath("/");
}

export async function addAccountTransactionAction(formData: FormData) {
  const input = accountTransactionSchema.parse({
    type: formData.get("type"),
    amount: formData.get("amount"),
    occurredAt: formData.get("occurredAt"),
    note: emptyToNull(formData.get("note")),
  });
  await addAccountTransaction(input);
  revalidatePath("/account");
  revalidatePath("/");
}

export async function deleteAccountTransactionAction(id: string) {
  await deleteAccountTransaction(id);
  revalidatePath("/account");
  revalidatePath("/");
}
