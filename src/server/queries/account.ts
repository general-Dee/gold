import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { accountSettings, accountTransactions } from "@/server/db/schema";
import { listTrades } from "@/server/queries/trades";
import type { AccountSettingsInput, AccountTransactionInput } from "@/lib/validation";

export async function getAccountSettings() {
  const [row] = await db.select().from(accountSettings).limit(1);
  return row;
}

export async function updateAccountSettings(input: AccountSettingsInput) {
  const settings = await getAccountSettings();
  const [row] = await db
    .update(accountSettings)
    .set({
      startingBalance: input.startingBalance,
      monthlyProfitTargetPct: input.monthlyProfitTargetPct ?? null,
      maxDrawdownLimitPct: input.maxDrawdownLimitPct ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(accountSettings.id, settings.id))
    .returning();
  return row;
}

/** Seeds a single zeroed settings row on first run only — never overwrites existing data. */
export async function seedDefaultAccountSettingsIfEmpty() {
  const existing = await db.select().from(accountSettings).limit(1);
  if (existing.length === 0) {
    await db.insert(accountSettings).values({});
  }
}

export async function listAccountTransactions() {
  return db.select().from(accountTransactions).orderBy(desc(accountTransactions.occurredAt));
}

export async function addAccountTransaction(input: AccountTransactionInput) {
  const [row] = await db
    .insert(accountTransactions)
    .values({
      type: input.type,
      amount: input.amount,
      occurredAt: input.occurredAt,
      note: input.note ?? null,
    })
    .returning();
  return row;
}

export async function deleteAccountTransaction(id: string) {
  await db.delete(accountTransactions).where(eq(accountTransactions.id, id));
}

export type BalancePoint = { at: string; balance: number; kind: "trade" | "deposit" | "withdrawal" };

/** Chronological running balance across every trade's pnl and every deposit/withdrawal,
 * starting from the account's starting balance. */
export async function getAccountEquityCurve(): Promise<BalancePoint[]> {
  const settings = await getAccountSettings();
  const [trades, txns] = await Promise.all([listTrades(), listAccountTransactions()]);

  const events = [
    ...trades
      .filter((t) => t.pnl != null)
      .map((t) => ({ at: t.entryAt, delta: t.pnl as number, kind: "trade" as const })),
    ...txns.map((t) => ({
      at: t.occurredAt,
      delta: t.type === "deposit" ? t.amount : -t.amount,
      kind: t.type as "deposit" | "withdrawal",
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  let balance = settings.startingBalance;
  return events.map((e) => {
    balance += e.delta;
    return { at: e.at, balance, kind: e.kind };
  });
}

export async function getCurrentBalance(): Promise<number> {
  const curve = await getAccountEquityCurve();
  if (curve.length > 0) return curve[curve.length - 1].balance;
  const settings = await getAccountSettings();
  return settings.startingBalance;
}

export type GoalProgress = {
  monthlyProfitTargetPct: number | null;
  monthToDateProfitPct: number | null;
  maxDrawdownLimitPct: number | null;
  currentDrawdownPct: number | null;
  isOverDrawdownLimit: boolean;
  isTargetReached: boolean;
};

export async function getGoalProgress(): Promise<GoalProgress> {
  const settings = await getAccountSettings();
  const curve = await getAccountEquityCurve();
  const currentBalance = curve.length > 0 ? curve[curve.length - 1].balance : settings.startingBalance;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const pointsBeforeMonth = curve.filter((p) => p.at < monthStart);
  const balanceAtMonthStart =
    pointsBeforeMonth.length > 0
      ? pointsBeforeMonth[pointsBeforeMonth.length - 1].balance
      : settings.startingBalance;
  const monthToDateProfitPct =
    balanceAtMonthStart !== 0 ? ((currentBalance - balanceAtMonthStart) / balanceAtMonthStart) * 100 : null;

  const peak = Math.max(settings.startingBalance, ...curve.map((p) => p.balance));
  const currentDrawdownPct = peak > 0 ? ((peak - currentBalance) / peak) * 100 : null;

  const isOverDrawdownLimit =
    settings.maxDrawdownLimitPct != null &&
    currentDrawdownPct != null &&
    currentDrawdownPct > settings.maxDrawdownLimitPct;

  const isTargetReached =
    settings.monthlyProfitTargetPct != null &&
    monthToDateProfitPct != null &&
    monthToDateProfitPct >= settings.monthlyProfitTargetPct;

  return {
    monthlyProfitTargetPct: settings.monthlyProfitTargetPct,
    monthToDateProfitPct,
    maxDrawdownLimitPct: settings.maxDrawdownLimitPct,
    currentDrawdownPct,
    isOverDrawdownLimit,
    isTargetReached,
  };
}
