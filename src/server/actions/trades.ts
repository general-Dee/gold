"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createTrade, deleteTrade, updateTrade } from "@/server/queries/trades";
import { tradeSchema } from "@/lib/validation";
import { evaluateBadgesForTrade } from "@/server/gamification/evaluate";

export async function createTradeAction(input: unknown) {
  const parsed = tradeSchema.parse(input);
  const trade = await createTrade(parsed);
  const unlocked = await evaluateBadgesForTrade(trade.id);

  revalidatePath("/trades");
  revalidatePath("/");
  redirect(`/trades/${trade.id}`);

  // unreachable, keeps the return type informative for callers/tests
  return { trade, unlocked };
}

export async function updateTradeAction(id: string, input: unknown) {
  const parsed = tradeSchema.parse(input);
  const trade = await updateTrade(id, parsed);
  await evaluateBadgesForTrade(id);

  revalidatePath("/trades");
  revalidatePath(`/trades/${id}`);
  revalidatePath("/");
  redirect(`/trades/${id}`);

  return trade;
}

export async function deleteTradeAction(id: string) {
  await deleteTrade(id);

  revalidatePath("/trades");
  revalidatePath("/");
  redirect("/trades");
}
