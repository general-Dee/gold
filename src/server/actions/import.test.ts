import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { bootstrapTestFirestore } from "@/server/testUtils/testFirestore";
import { rowsToCsv } from "@/lib/csv";

// revalidatePath requires Next's request-scoped internals, which don't exist
// in a bare vitest run — calling it unmocked throws immediately.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// importTradesAction transitively imports "@/server/firebase/client", which
// binds to the emulator project as a module-load side effect. A static
// top-level import would run before bootstrapTestFirestore() sets
// FIREBASE_PROJECT_ID, so it's imported dynamically inside beforeAll instead.
// rowsToCsv itself has no db dependency, so it's safe to import statically
// above.
let wipe: Awaited<ReturnType<typeof bootstrapTestFirestore>>["wipe"];
let tradesCollection: typeof import("@/server/firebase/collections").tradesCollection;
let importTradesAction: typeof import("@/server/actions/import").importTradesAction;

beforeAll(async () => {
  ({ wipe } = await bootstrapTestFirestore());
  ({ tradesCollection } = await import("@/server/firebase/collections"));
  ({ importTradesAction } = await import("@/server/actions/import"));
});

beforeEach(async () => {
  await wipe();
  vi.mocked(revalidatePath).mockClear();
});

async function allTradeRows() {
  return (await tradesCollection().get()).docs.map((d) => d.data());
}

// Full CSV export column set — mirrors queries/trades.test.ts's own IMPORT_HEADERS,
// kept local since this file only needs one valid-row shape and one
// invalid-row shape, not the full CSV-parsing matrix already covered there.
const IMPORT_HEADERS = [
  "entryAt", "exitAt", "direction", "instrument", "status",
  "entryPrice", "exitPrice", "stopLoss", "takeProfit", "positionSize",
  "riskRewardPlanned", "riskRewardRealized", "outcome", "pnl",
  "setupTag", "session", "dxyBias", "newsNearby", "newsNote",
  "moodBefore", "moodAfter", "reasoning", "notesAfter",
];

function buildImportRow(overrides: Record<string, string | number | boolean | null> = {}) {
  const base: Record<string, string | number | boolean | null> = {
    entryAt: "2026-01-01T10:00:00.000Z",
    exitAt: null,
    direction: "long",
    instrument: "XAUUSD",
    status: "closed",
    entryPrice: 100,
    exitPrice: null,
    stopLoss: 95,
    takeProfit: null,
    positionSize: 1,
    riskRewardPlanned: null,
    riskRewardRealized: null,
    outcome: null,
    pnl: null,
    setupTag: null,
    session: "ny",
    dxyBias: null,
    newsNearby: false,
    newsNote: null,
    moodBefore: null,
    moodAfter: null,
    reasoning: null,
    notesAfter: null,
    ...overrides,
  };
  return IMPORT_HEADERS.map((h) => base[h]);
}

function buildImportCsv(rows: (string | number | boolean | null)[][]) {
  return rowsToCsv(IMPORT_HEADERS, rows);
}

function fileFromCsv(text: string) {
  const fd = new FormData();
  fd.set("file", new File([text], "trades.csv", { type: "text/csv" }));
  return fd;
}

describe("importTradesAction", () => {
  it("throws 'No file selected.' when the file field is missing", async () => {
    await expect(importTradesAction(new FormData())).rejects.toThrow("No file selected.");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws 'No file selected.' when the file is present but empty", async () => {
    const fd = new FormData();
    fd.set("file", new File([], "trades.csv", { type: "text/csv" }));

    await expect(importTradesAction(fd)).rejects.toThrow("No file selected.");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("imports valid rows via the query layer and revalidates /trades and / when at least one row imports", async () => {
    const fd = fileFromCsv(buildImportCsv([buildImportRow()]));

    const result = await importTradesAction(fd);

    expect(result.importedCount).toBe(1);
    expect(await allTradeRows()).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith("/trades");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("does not revalidate anything when importedCount is 0", async () => {
    const fd = fileFromCsv(buildImportCsv([buildImportRow({ session: "tokyo" })]));

    const result = await importTradesAction(fd);

    expect(result.importedCount).toBe(0);
    expect(result.skipped).toHaveLength(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("lets a query-layer rejection (e.g. missing required headers) propagate", async () => {
    const fd = fileFromCsv("a,b\r\n1,2");

    await expect(importTradesAction(fd)).rejects.toThrow(/doesn't look like a trades export/);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
