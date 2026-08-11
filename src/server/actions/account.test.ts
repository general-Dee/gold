import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { bootstrapTestFirestore } from "@/server/testUtils/testFirestore";

// revalidatePath requires Next's request-scoped internals, which don't exist
// in a bare vitest run — calling it unmocked throws immediately.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The actions under test transitively import "@/server/firebase/client",
// which binds to the emulator project as a module-load side effect. A
// static top-level import would run before bootstrapTestFirestore() sets
// FIREBASE_PROJECT_ID, so they're imported dynamically inside beforeAll.
let wipe: Awaited<ReturnType<typeof bootstrapTestFirestore>>["wipe"];
let accountSettingsCollection: typeof import("@/server/firebase/collections").accountSettingsCollection;
let accountTransactionsCollection: typeof import("@/server/firebase/collections").accountTransactionsCollection;
let updateAccountSettingsAction: typeof import("@/server/actions/account").updateAccountSettingsAction;
let addAccountTransactionAction: typeof import("@/server/actions/account").addAccountTransactionAction;
let deleteAccountTransactionAction: typeof import("@/server/actions/account").deleteAccountTransactionAction;
let seedDefaultAccountSettingsIfEmpty: typeof import("@/server/queries/account").seedDefaultAccountSettingsIfEmpty;
let addAccountTransaction: typeof import("@/server/queries/account").addAccountTransaction;

beforeAll(async () => {
  ({ wipe } = await bootstrapTestFirestore());
  ({ accountSettingsCollection, accountTransactionsCollection } = await import(
    "@/server/firebase/collections"
  ));
  ({ updateAccountSettingsAction, addAccountTransactionAction, deleteAccountTransactionAction } =
    await import("@/server/actions/account"));
  ({ seedDefaultAccountSettingsIfEmpty, addAccountTransaction } = await import(
    "@/server/queries/account"
  ));
});

beforeEach(async () => {
  await wipe();
  // updateAccountSettings() reads the existing singleton doc and assumes it
  // exists (no null guard) — an empty collection throws a plain TypeError
  // before validation is even relevant, so every test in this file needs a
  // pre-existing doc.
  await seedDefaultAccountSettingsIfEmpty();
  vi.mocked(revalidatePath).mockClear();
});

async function allAccountSettingsRows() {
  return (await accountSettingsCollection().get()).docs.map((d) => d.data());
}
async function allTransactionRows() {
  return (await accountTransactionsCollection().get()).docs.map((d) => d.data());
}

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

    const [row] = await allAccountSettingsRows();
    expect(row).toMatchObject({ startingBalance: 1000, monthlyProfitTargetPct: 5, maxDrawdownLimitPct: 10 });
    expect(revalidatePath).toHaveBeenCalledWith("/account");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("treats empty-string optional fields as null rather than coercing to 0", async () => {
    await updateAccountSettingsAction(
      buildSettingsFormData({ monthlyProfitTargetPct: "", maxDrawdownLimitPct: "" }),
    );

    const [row] = await allAccountSettingsRows();
    expect(row!.monthlyProfitTargetPct).toBeNull();
    expect(row!.maxDrawdownLimitPct).toBeNull();
  });
});

describe("addAccountTransactionAction", () => {
  it("parses FormData and adds a transaction, revalidating /account and /", async () => {
    await addAccountTransactionAction(buildTransactionFormData());

    const rows = await allTransactionRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "deposit", amount: 500, note: "Bonus" });
    expect(revalidatePath).toHaveBeenCalledWith("/account");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("normalizes an empty note to null", async () => {
    await addAccountTransactionAction(buildTransactionFormData({ note: "" }));

    const [row] = await allTransactionRows();
    expect(row!.note).toBeNull();
  });

  it("throws a ZodError for an invalid transaction type and inserts nothing", async () => {
    await expect(
      addAccountTransactionAction(buildTransactionFormData({ type: "not_a_real_type" })),
    ).rejects.toThrow();

    const rows = await allTransactionRows();
    expect(rows).toEqual([]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws for a non-positive amount", async () => {
    await expect(addAccountTransactionAction(buildTransactionFormData({ amount: "0" }))).rejects.toThrow();

    const rows = await allTransactionRows();
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

    const rows = await allTransactionRows();
    expect(rows).toEqual([]);
    expect(revalidatePath).toHaveBeenCalledWith("/account");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  // deleteAccountTransaction is a bare doc delete with no existence guard,
  // so a bogus id doesn't throw — it's just a no-op.
  it("is a no-op for an id that doesn't exist", async () => {
    await expect(deleteAccountTransactionAction("does-not-exist")).resolves.not.toThrow();
    expect(revalidatePath).toHaveBeenCalledWith("/account");
  });
});
