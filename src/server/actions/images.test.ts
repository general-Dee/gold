import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { bootstrapTestDb } from "@/server/testUtils/testDb";
import { tradeSchema } from "@/lib/validation";

// revalidatePath requires Next's request-scoped internals, which don't exist
// in a bare vitest run — calling it unmocked throws immediately.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The actions under test transitively import "@/server/db/client", which
// creates its sqlite client as a module-load side effect. A static top-level
// import would run before bootstrapTestDb() sets DATABASE_URL, so they're
// imported dynamically inside beforeAll instead (see gamification.test.ts for
// the failure mode this avoids). tradeSchema itself has no db dependency, so
// it's safe to import statically above.
let db: Awaited<ReturnType<typeof bootstrapTestDb>>["db"];
let schema: Awaited<ReturnType<typeof bootstrapTestDb>>["schema"];
let uploadTradeImageAction: typeof import("@/server/actions/images").uploadTradeImageAction;
let deleteTradeImageAction: typeof import("@/server/actions/images").deleteTradeImageAction;
let updateTradeImageCaptionAction: typeof import("@/server/actions/images").updateTradeImageCaptionAction;
let createTrade: typeof import("@/server/queries/trades").createTrade;
let deleteTradeImage: typeof import("@/server/queries/images").deleteTradeImage;

beforeAll(async () => {
  ({ db, schema } = await bootstrapTestDb());
  ({ uploadTradeImageAction, deleteTradeImageAction, updateTradeImageCaptionAction } = await import(
    "@/server/actions/images"
  ));
  ({ createTrade } = await import("@/server/queries/trades"));
  ({ deleteTradeImage } = await import("@/server/queries/images"));
});

beforeEach(async () => {
  await db.delete(schema.tradeImages);
  await db.delete(schema.trades);
  vi.mocked(revalidatePath).mockClear();
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

describe("uploadTradeImageAction", () => {
  it("saves the file to disk, inserts a row, and revalidates the trade's detail page", async () => {
    const trade = await makeTrade();
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "chart.png", { type: "image/png" }));
    fd.set("caption", "Entry setup");

    await uploadTradeImageAction(trade.id, fd);

    const [row] = await db.select().from(schema.tradeImages);
    expect(row).toMatchObject({ tradeId: trade.id, caption: "Entry setup" });
    expect(row.filePath).toMatch(/\.png$/);
    expect(revalidatePath).toHaveBeenCalledWith(`/trades/${trade.id}`);

    await deleteTradeImage(row.id);
  });

  it("stores a null caption when none is provided", async () => {
    const trade = await makeTrade();
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "chart.png", { type: "image/png" }));

    await uploadTradeImageAction(trade.id, fd);

    const [row] = await db.select().from(schema.tradeImages);
    expect(row.caption).toBeNull();

    await deleteTradeImage(row.id);
  });

  it("throws 'Please choose a file to upload.' when the file field is missing entirely", async () => {
    const trade = await makeTrade();
    const fd = new FormData();

    await expect(uploadTradeImageAction(trade.id, fd)).rejects.toThrow(
      "Please choose a file to upload.",
    );
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await db.select().from(schema.tradeImages)).toEqual([]);
  });

  it("throws 'Please choose a file to upload.' when the file is present but empty", async () => {
    const trade = await makeTrade();
    const fd = new FormData();
    fd.set("file", new File([], "empty.png", { type: "image/png" }));

    await expect(uploadTradeImageAction(trade.id, fd)).rejects.toThrow(
      "Please choose a file to upload.",
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws 'Images must be 5MB or smaller.' for an oversized file", async () => {
    const trade = await makeTrade();
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }));

    await expect(uploadTradeImageAction(trade.id, fd)).rejects.toThrow("Images must be 5MB or smaller.");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("throws 'Unsupported file type...' for a disallowed extension", async () => {
    const trade = await makeTrade();
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "malware.exe"));

    await expect(uploadTradeImageAction(trade.id, fd)).rejects.toThrow(/Unsupported file type/);
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await db.select().from(schema.tradeImages)).toEqual([]);
  });
});

describe("deleteTradeImageAction", () => {
  it("deletes an existing image and revalidates the trade's detail page", async () => {
    const trade = await makeTrade();
    const [image] = await db
      .insert(schema.tradeImages)
      .values({ tradeId: trade.id, filePath: "does-not-exist-on-disk.png", caption: "Entry" })
      .returning();

    await deleteTradeImageAction(image.id, trade.id);

    expect(await db.select().from(schema.tradeImages)).toEqual([]);
    expect(revalidatePath).toHaveBeenCalledWith(`/trades/${trade.id}`);
  });

  it("throws 'Image not found.' for a nonexistent id without revalidating", async () => {
    const trade = await makeTrade();

    await expect(deleteTradeImageAction("does-not-exist", trade.id)).rejects.toThrow(
      "Image not found.",
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateTradeImageCaptionAction", () => {
  it("updates the caption and revalidates the trade's detail page", async () => {
    const trade = await makeTrade();
    const [image] = await db
      .insert(schema.tradeImages)
      .values({ tradeId: trade.id, filePath: "a.png", caption: null })
      .returning();

    await updateTradeImageCaptionAction(image.id, trade.id, "15m entry confirmation");

    const [row] = await db.select().from(schema.tradeImages);
    expect(row.caption).toBe("15m entry confirmation");
    expect(revalidatePath).toHaveBeenCalledWith(`/trades/${trade.id}`);
  });

  it("throws 'Image not found.' for a nonexistent id without revalidating", async () => {
    const trade = await makeTrade();

    await expect(
      updateTradeImageCaptionAction("does-not-exist", trade.id, "caption"),
    ).rejects.toThrow("Image not found.");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
