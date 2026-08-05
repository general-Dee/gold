import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { bootstrapTestDb } from "@/server/testUtils/testDb";

// revalidatePath requires Next's request-scoped internals, which don't exist
// in a bare vitest run — calling it unmocked throws immediately.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The actions under test transitively import "@/server/db/client", which
// creates its sqlite client as a module-load side effect. A static top-level
// import would run before bootstrapTestDb() sets DATABASE_URL, so they're
// imported dynamically inside beforeAll instead (see gamification.test.ts for
// the failure mode this avoids).
let db: Awaited<ReturnType<typeof bootstrapTestDb>>["db"];
let schema: Awaited<ReturnType<typeof bootstrapTestDb>>["schema"];
let updateAccountSettingsAction: typeof import("@/server/actions/account").updateAccountSettingsAction;
let addAccountTransactionAction: typeof import("@/server/actions/account").addAccountTransactionAction;
let deleteAccountTransactionAction: typeof import("@/server/actions/account").deleteAccountTransactionAction;
let seedDefaultAccountSettingsIfEmpty: typeof import("@/server/queries/account").seedDefaultAccountSettingsIfEmpty;
let addAccountTransaction: typeof import("@/server/queries/account").addAccountTransaction;

beforeAll(async () => {
  ({ db, schema } = await bootstrapTestDb());
  ({ updateAccountSettingsAction, addAccountTransactionAction, deleteAccountTransactionAction } =
    await import("@/server/actions/account"));
  ({ seedDefaultAccountSettingsIfEmpty, addAccountTransaction } = await import(
    "@/server/queries/account"
  ));
});

beforeEach(async () => {
  await db.delete(schema.accountTransactions);
  await db.delete(schema.accountSettings);
  // updateAccountSettings() reads the existing settings row via
  // getAccountSettings() and accesses its .id with no null guard — an empty
  // table throws a plain TypeError before validation is even relevant, so
  // every test in this file needs a pre-existing row.
  await seedDefaultAccountSettingsIfEmpty();
  vi.mocked(revalidatePath).mockClear();
});

function buildSettingsFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const values = { startingBalance: "1000", monthlyProfitTargetPct: "5", maxDrawdownLimitPct: "10", ...overrides };
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}

function buildTransactionFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const values = {
    type: "deposit",
    amount: "500",
    occurredAt: "2026-08-01T10:00:00.000Z",
    note: "Bonus",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}

describe("updateAccountSettingsAction", () => {
  it("parses FormData and updates settings, revalidating /account and /", async () => {
    await updateAccountSettingsAction(buildSettingsFormData());

    const [row] = await db.select().from(schema.accountSettings);
    expect(row).toMatchObject({ startingBalance: 1000, monthlyProfitTargetPct: 5, maxDrawdownLimitPct: 10 });
    expect(revalidatePath).toHaveBeenCalledWith("/account");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("treats empty-string optional fields as null rather than coercing to 0", async () => {
    await updateAccountSettingsAction(
      buildSettingsFormData({ monthlyProfitTargetPct: "", maxDrawdownLimitPct: "" }),
    );

    const [row] = await db.select().from(schema.accountSettings);
    expect(row.monthlyProfitTargetPct).toBeNull();
    expect(row.maxDrawdownLimitPct).toBeNull();
  });
});

describe("addAccountTransactionAction", () => {
  it("parses FormData and adds a transaction, revalidating /account and /", async () => {
    await addAccountTransactionAction(buildTransactionFormData());

    const rows = await db.select().from(schema.accountTransactions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "deposit", amount: 500, note: "Bonus" });
    expect(revalidatePath).toHaveBeenCalledWith("/account");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("normalizes an empty note to null", async () => {
    await addAccountTransactionAction(buildTransactionFormData({ note: "" }));

    const [row] = await db.select().from(schema.accountTransactions);
    expect(row.note).toBeNull();
  });

  it("throws a ZodError for an invalid transaction type and inserts nothing", async () => {
    await expect(
      addAccountTransactionAction(buildTransactionFormData({ type: "not_a_real_type" })),
    ).rejects.toThrow();

    const rows = await db.select().from(schema.accountTransactions);
    expect(rows).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws for a non-positive amount", async () => {
    await expect(addAccountTransactionAction(buildTransactionFormData({ amount: "0" }))).rejects.toThrow();

    const rows = await db.select().from(schema.accountTransactions);
    expect(rows).toEqual([]);
  });
});

describe("deleteAccountTransactionAction", () => {
  it("deletes the transaction and revalidates /account and /", async () => {
    const txn = await addAccountTransaction({
      type: "deposit",
      amount: 100,
      occurredAt: "2026-08-01T10:00:00.000Z",
      note: null,
    });

    await deleteAccountTransactionAction(txn.id);

    const rows = await db.select().from(schema.accountTransactions);
    expect(rows).toEqual([]);
    expect(revalidatePath).toHaveBeenCalledWith("/account");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  // deleteAccountTransaction is a bare .delete().where(eq(id)) with no
  // existence guard, so a bogus id doesn't throw — it just deletes zero rows.
  it("is a no-op for an id that doesn't exist", async () => {
    await expect(deleteAccountTransactionAction("does-not-exist")).resolves.not.toThrow();
    expect(revalidatePath).toHaveBeenCalledWith("/account");
  });
});
