import {
  ACCOUNT_SETTINGS_SINGLETON_ID,
  accountSettingsCollection,
  accountTransactionsCollection,
  type AccountSettings,
  type AccountTransaction,
} from "@/server/firebase/collections";
import { nanoid } from "@/server/firebase/ids";
import { listTrades } from "@/server/queries/trades";
import type { AccountSettingsInput, AccountTransactionInput } from "@/lib/validation";

// Doesn't assume the root layout's seedDefaultAccountSettingsIfEmpty() has already run —
// Next.js explicitly parallelizes layout and page data-fetching, so a page calling this
// can race ahead of the layout's seed write. Self-heals instead of asserting non-null.
export async function getAccountSettings() {
  const ref = accountSettingsCollection().doc(ACCOUNT_SETTINGS_SINGLETON_ID);
  const doc = await ref.get();
  if (doc.exists) return doc.data()!;
  await seedDefaultAccountSettingsIfEmpty();
  return (await ref.get()).data()!;
}

export async function updateAccountSettings(input: AccountSettingsInput): Promise<AccountSettings> {
  const ref = accountSettingsCollection().doc(ACCOUNT_SETTINGS_SINGLETON_ID);
  const existing = (await ref.get()).data()!;
  const row: AccountSettings = {
    ...existing,
    startingBalance: input.startingBalance,
    monthlyProfitTargetPct: input.monthlyProfitTargetPct ?? null,
    maxDrawdownLimitPct: input.maxDrawdownLimitPct ?? null,
    updatedAt: new Date().toISOString(),
  };
  await ref.set(row);
  return row;
}

/** Seeds a single zeroed settings row on first run only — never overwrites existing data. */
export async function seedDefaultAccountSettingsIfEmpty() {
  const ref = accountSettingsCollection().doc(ACCOUNT_SETTINGS_SINGLETON_ID);
  const existing = await ref.get();
  if (!existing.exists) {
    const now = new Date().toISOString();
    const row: AccountSettings = {
      id: ACCOUNT_SETTINGS_SINGLETON_ID,
      startingBalance: 0,
      monthlyProfitTargetPct: null,
      maxDrawdownLimitPct: null,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(row);
  }
}

export async function listAccountTransactions() {
  const snapshot = await accountTransactionsCollection().orderBy("occurredAt", "desc").get();
  return snapshot.docs.map((doc) => doc.data());
}

export async function addAccountTransaction(input: AccountTransactionInput): Promise<AccountTransaction> {
  const row: AccountTransaction = {
    id: nanoid(),
    type: input.type,
    amount: input.amount,
    occurredAt: input.occurredAt,
    note: input.note ?? null,
    createdAt: new Date().toISOString(),
  };
  await accountTransactionsCollection().doc(row.id).set(row);
  return row;
}

export async function deleteAccountTransaction(id: string) {
  await accountTransactionsCollection().doc(id).delete();
}

export type BalancePoint = { at: string; balance: number; kind: "trade" | "deposit" | "withdrawal" };

/** Chronological running balance across every trade's pnl and every deposit/withdrawal,
 * starting from the account's starting balance. */
export async function getAccountEquityCurve(): Promise<BalancePoint[]> {
  const settings = await getAccountSettings();
  const [trades, txns] = await Promise.all([listTrades(), listAccountTransactions()]);

  const events = [
    // This filter also excludes open trades (no pnl yet) from the balance curve —
    // an open trade shouldn't move the account balance until it's closed.
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
  if (curve.length > 0) return curve[curve.length - 1]!.balance;
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
  const currentBalance = curve.length > 0 ? curve[curve.length - 1]!.balance : settings.startingBalance;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const pointsBeforeMonth = curve.filter((p) => p.at < monthStart);
  const balanceAtMonthStart =
    pointsBeforeMonth.length > 0
      ? pointsBeforeMonth[pointsBeforeMonth.length - 1]!.balance
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
