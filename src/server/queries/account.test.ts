import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrapTestDb } from "@/server/testUtils/testDb";
import { tradeSchema } from "@/lib/validation";

// Every function under test transitively imports "@/server/db/client", which
// creates its sqlite client as a module-load side effect. A static top-level
// import would run before bootstrapTestDb() sets DATABASE_URL, so everything
// is imported dynamically inside beforeAll instead (see gamification.test.ts
// for the failure mode this avoids).
let db: Awaited<ReturnType<typeof bootstrapTestDb>>["db"];
let schema: Awaited<ReturnType<typeof bootstrapTestDb>>["schema"];
let account: typeof import("@/server/queries/account");
let createTrade: typeof import("@/server/queries/trades").createTrade;

beforeAll(async () => {
  ({ db, schema } = await bootstrapTestDb());
  account = await import("@/server/queries/account");
  ({ createTrade } = await import("@/server/queries/trades"));
});

beforeEach(async () => {
  await db.delete(schema.tradeRuleChecks);
  await db.delete(schema.trades);
  await db.delete(schema.accountTransactions);
  await db.delete(schema.accountSettings);
});

async function addTrade(entryAt: string, pnl: number | null) {
  await createTrade(
    tradeSchema.parse({
      direction: "long",
      entryPrice: 100,
      stopLoss: 95,
      positionSize: 1,
      session: "ny",
      entryAt,
      pnl,
    }),
  );
}

describe("seedDefaultAccountSettingsIfEmpty", () => {
  it("inserts a single zeroed row when empty", async () => {
    await account.seedDefaultAccountSettingsIfEmpty();
    const rows = await db.select().from(schema.accountSettings);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      startingBalance: 0,
      monthlyProfitTargetPct: null,
      maxDrawdownLimitPct: null,
    });
  });

  it("does not insert a second row if one already exists", async () => {
    await account.seedDefaultAccountSettingsIfEmpty();
    await account.seedDefaultAccountSettingsIfEmpty();
    expect(await db.select().from(schema.accountSettings)).toHaveLength(1);
  });
});

describe("updateAccountSettings", () => {
  it("updates the singleton row's fields", async () => {
    await account.seedDefaultAccountSettingsIfEmpty();
    await account.updateAccountSettings({
      startingBalance: 10000,
      monthlyProfitTargetPct: 5,
      maxDrawdownLimitPct: 10,
    });

    const settings = await account.getAccountSettings();
    expect(settings).toMatchObject({
      startingBalance: 10000,
      monthlyProfitTargetPct: 5,
      maxDrawdownLimitPct: 10,
    });
  });
});

describe("addAccountTransaction / listAccountTransactions / deleteAccountTransaction", () => {
  it("adds, lists (newest first), and deletes transactions", async () => {
    await account.seedDefaultAccountSettingsIfEmpty();
    const deposit = await account.addAccountTransaction({
      type: "deposit",
      amount: 500,
      occurredAt: "2026-01-01T10:00:00.000Z",
    });
    await account.addAccountTransaction({
      type: "withdrawal",
      amount: 100,
      occurredAt: "2026-01-05T10:00:00.000Z",
    });

    const list = await account.listAccountTransactions();
    expect(list.map((t) => t.type)).toEqual(["withdrawal", "deposit"]);

    await account.deleteAccountTransaction(deposit.id);
    expect(await account.listAccountTransactions()).toHaveLength(1);
  });
});

describe("getAccountEquityCurve / getCurrentBalance", () => {
  it("merges trades and transactions in chronological order on top of the starting balance", async () => {
    await account.seedDefaultAccountSettingsIfEmpty();
    await account.updateAccountSettings({ startingBalance: 1000 });

    await addTrade("2026-01-02T10:00:00.000Z", 100);
    await account.addAccountTransaction({
      type: "deposit",
      amount: 500,
      occurredAt: "2026-01-01T10:00:00.000Z",
    });
    await addTrade("2026-01-03T10:00:00.000Z", -50);
    await account.addAccountTransaction({
      type: "withdrawal",
      amount: 200,
      occurredAt: "2026-01-04T10:00:00.000Z",
    });

    const curve = await account.getAccountEquityCurve();
    expect(curve.map((p) => [p.kind, p.balance])).toEqual([
      ["deposit", 1500],
      ["trade", 1600],
      ["trade", 1550],
      ["withdrawal", 1350],
    ]);

    expect(await account.getCurrentBalance()).toBe(1350);
  });

  it("returns the starting balance when there are no trades or transactions", async () => {
    await account.seedDefaultAccountSettingsIfEmpty();
    await account.updateAccountSettings({ startingBalance: 2500 });

    expect(await account.getAccountEquityCurve()).toEqual([]);
    expect(await account.getCurrentBalance()).toBe(2500);
  });
});

describe("getGoalProgress", () => {
  it("returns null goal fields when no targets are set", async () => {
    await account.seedDefaultAccountSettingsIfEmpty();
    await account.updateAccountSettings({ startingBalance: 1000 });

    const progress = await account.getGoalProgress();
    expect(progress.monthlyProfitTargetPct).toBeNull();
    expect(progress.maxDrawdownLimitPct).toBeNull();
    expect(progress.isOverDrawdownLimit).toBe(false);
  });

  it("flags isOverDrawdownLimit once the drawdown from peak exceeds the configured limit", async () => {
    await account.seedDefaultAccountSettingsIfEmpty();
    await account.updateAccountSettings({ startingBalance: 1000, maxDrawdownLimitPct: 10 });

    // Peak reaches 1200, then a loss drops the balance to 1000 — a 16.67% drawdown from peak.
    await addTrade("2026-01-01T10:00:00.000Z", 200);
    await addTrade("2026-01-02T10:00:00.000Z", -200);

    const progress = await account.getGoalProgress();
    expect(progress.currentDrawdownPct).toBeCloseTo(16.666, 2);
    expect(progress.isOverDrawdownLimit).toBe(true);
  });

  it("does not flag isOverDrawdownLimit when within the limit", async () => {
    await account.seedDefaultAccountSettingsIfEmpty();
    await account.updateAccountSettings({ startingBalance: 1000, maxDrawdownLimitPct: 50 });

    await addTrade("2026-01-01T10:00:00.000Z", 200);
    await addTrade("2026-01-02T10:00:00.000Z", -200);

    const progress = await account.getGoalProgress();
    expect(progress.isOverDrawdownLimit).toBe(false);
  });

  it("computes month-to-date profit percent relative to the balance at the start of the month", async () => {
    await account.seedDefaultAccountSettingsIfEmpty();
    await account.updateAccountSettings({ startingBalance: 1000 });

    const now = new Date();
    const earlierThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12).toISOString();
    await addTrade(earlierThisMonth, 100);

    const progress = await account.getGoalProgress();
    expect(progress.monthToDateProfitPct).toBeCloseTo(10, 5);
  });
});
