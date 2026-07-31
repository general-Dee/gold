import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { bootstrapTestDb } from "@/server/testUtils/testDb";
import { tradeSchema } from "@/lib/validation";

// saveTradeImage/deleteTradeImage/updateTradeImageCaption transitively import
// "@/server/db/client", which creates its sqlite client as a module-load side
// effect. A static top-level import would run before bootstrapTestDb() sets
// DATABASE_URL, so it's imported dynamically inside beforeAll instead (see
// gamification.test.ts for the failure mode this avoids).
let db: Awaited<ReturnType<typeof bootstrapTestDb>>["db"];
let schema: Awaited<ReturnType<typeof bootstrapTestDb>>["schema"];
let createTrade: typeof import("@/server/queries/trades").createTrade;
let saveTradeImage: typeof import("@/server/queries/images").saveTradeImage;
let deleteTradeImage: typeof import("@/server/queries/images").deleteTradeImage;
let updateTradeImageCaption: typeof import("@/server/queries/images").updateTradeImageCaption;

beforeAll(async () => {
  ({ db, schema } = await bootstrapTestDb());
  ({ createTrade } = await import("@/server/queries/trades"));
  ({ saveTradeImage, deleteTradeImage, updateTradeImageCaption } = await import(
    "@/server/queries/images"
  ));
});

beforeEach(async () => {
  await db.delete(schema.tradeImages);
  await db.delete(schema.trades);
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

describe("deleteTradeImage", () => {
  it("removes the DB row and tolerates a file that's already gone from disk", async () => {
    const trade = await makeTrade();
    const [image] = await db
      .insert(schema.tradeImages)
      .values({ tradeId: trade.id, filePath: "does-not-exist-on-disk.png", caption: "Entry" })
      .returning();

    const result = await deleteTradeImage(image.id);
    expect(result).toEqual({ tradeId: trade.id });

    const remaining = await db.select().from(schema.tradeImages);
    expect(remaining).toEqual([]);
  });

  it("returns null for an id that doesn't exist", async () => {
    expect(await deleteTradeImage("does-not-exist")).toBeNull();
  });
});

describe("updateTradeImageCaption", () => {
  it("sets a caption", async () => {
    const trade = await makeTrade();
    const [image] = await db
      .insert(schema.tradeImages)
      .values({ tradeId: trade.id, filePath: "a.png", caption: null })
      .returning();

    const result = await updateTradeImageCaption(image.id, "15m entry confirmation");
    expect(result).toEqual({ tradeId: trade.id, caption: "15m entry confirmation" });
  });

  it("normalizes blank/whitespace-only input to null", async () => {
    const trade = await makeTrade();
    const [image] = await db
      .insert(schema.tradeImages)
      .values({ tradeId: trade.id, filePath: "a.png", caption: "Old caption" })
      .returning();

    const result = await updateTradeImageCaption(image.id, "   ");
    expect(result?.caption).toBeNull();
  });

  it("returns null for an id that doesn't exist", async () => {
    expect(await updateTradeImageCaption("does-not-exist", "caption")).toBeNull();
  });
});

describe("saveTradeImage", () => {
  it("writes the file and inserts a row, then cleans up via deleteTradeImage", async () => {
    const trade = await makeTrade();

    const row = await saveTradeImage(
      trade.id,
      { fileName: "chart.png", buffer: Buffer.from("fake-png-bytes") },
      "Entry confirmation",
    );

    expect(row.tradeId).toBe(trade.id);
    expect(row.filePath).toMatch(/\.png$/);
    expect(row.caption).toBe("Entry confirmation");

    const result = await deleteTradeImage(row.id);
    expect(result).toEqual({ tradeId: trade.id });
  });
});
