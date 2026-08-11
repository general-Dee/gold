import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrapTestFirestore } from "@/server/testUtils/testFirestore";
import { tradeSchema } from "@/lib/validation";

// saveTradeImage/deleteTradeImage/updateTradeImageCaption transitively import
// "@/server/firebase/client", which binds to the emulator project as a
// module-load side effect. A static top-level import would run before
// bootstrapTestFirestore() sets FIREBASE_PROJECT_ID, so it's imported
// dynamically inside beforeAll instead.
let wipe: Awaited<ReturnType<typeof bootstrapTestFirestore>>["wipe"];
let tradeImagesCollection: typeof import("@/server/firebase/collections").tradeImagesCollection;
let createTrade: typeof import("@/server/queries/trades").createTrade;
let saveTradeImage: typeof import("@/server/queries/images").saveTradeImage;
let deleteTradeImage: typeof import("@/server/queries/images").deleteTradeImage;
let updateTradeImageCaption: typeof import("@/server/queries/images").updateTradeImageCaption;

beforeAll(async () => {
  ({ wipe } = await bootstrapTestFirestore());
  ({ tradeImagesCollection } = await import("@/server/firebase/collections"));
  ({ createTrade } = await import("@/server/queries/trades"));
  ({ saveTradeImage, deleteTradeImage, updateTradeImageCaption } = await import(
    "@/server/queries/images"
  ));
});

beforeEach(async () => {
  await wipe();
});

async function makeTrade() {
  return createTrade(
    tradeSchema.parse({
      direction: "long",
      entryPrice: 100,
      stopLoss: 95,
      positionSize: 1,
      session: "ny",
      entryAt: "2026-01-01T10:00:00.000Z",
    }),
  );
}

async function seedImage(tradeId: string, filePath: string, caption: string | null) {
  const now = new Date().toISOString();
  const ref = tradeImagesCollection(tradeId).doc();
  const row = { id: ref.id, filePath, caption, createdAt: now };
  await ref.set(row);
  return row;
}

describe("deleteTradeImage", () => {
  it("removes the doc and tolerates a file that's already gone from disk", async () => {
    const trade = await makeTrade();
    const image = await seedImage(trade.id, "does-not-exist-on-disk.png", "Entry");

    const result = await deleteTradeImage(trade.id, image.id);
    expect(result).toEqual({ tradeId: trade.id });

    const remaining = await tradeImagesCollection(trade.id).get();
    expect(remaining.empty).toBe(true);
  });

  it("returns null for an id that doesn't exist", async () => {
    const trade = await makeTrade();
    expect(await deleteTradeImage(trade.id, "does-not-exist")).toBeNull();
  });
});

describe("updateTradeImageCaption", () => {
  it("sets a caption", async () => {
    const trade = await makeTrade();
    const image = await seedImage(trade.id, "a.png", null);

    const result = await updateTradeImageCaption(trade.id, image.id, "15m entry confirmation");
    expect(result).toEqual({ tradeId: trade.id, caption: "15m entry confirmation" });
  });

  it("normalizes blank/whitespace-only input to null", async () => {
    const trade = await makeTrade();
    const image = await seedImage(trade.id, "a.png", "Old caption");

    const result = await updateTradeImageCaption(trade.id, image.id, "   ");
    expect(result?.caption).toBeNull();
  });

  it("returns null for an id that doesn't exist", async () => {
    const trade = await makeTrade();
    expect(await updateTradeImageCaption(trade.id, "does-not-exist", "caption")).toBeNull();
  });
});

describe("saveTradeImage", () => {
  it("writes the file and creates a doc, then cleans up via deleteTradeImage", async () => {
    const trade = await makeTrade();

    const row = await saveTradeImage(
      trade.id,
      { fileName: "chart.png", buffer: Buffer.from("fake-png-bytes") },
      "Entry confirmation",
    );

    expect(row.filePath).toMatch(/\.png$/);
    expect(row.caption).toBe("Entry confirmation");

    const result = await deleteTradeImage(trade.id, row.id);
    expect(result).toEqual({ tradeId: trade.id });
  });
});
