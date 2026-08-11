import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { bootstrapTestFirestore } from "@/server/testUtils/testFirestore";
import { tradeSchema } from "@/lib/validation";

// revalidatePath requires Next's request-scoped internals, which don't exist
// in a bare vitest run — calling it unmocked throws immediately.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// The actions under test transitively import "@/server/firebase/client",
// which binds to the emulator project as a module-load side effect. A static
// top-level import would run before bootstrapTestFirestore() sets
// FIREBASE_PROJECT_ID, so they're imported dynamically inside beforeAll.
// tradeSchema itself has no db dependency, so it's safe to import statically
// above.
let wipe: Awaited<ReturnType<typeof bootstrapTestFirestore>>["wipe"];
let tradeImagesCollection: typeof import("@/server/firebase/collections").tradeImagesCollection;
let uploadTradeImageAction: typeof import("@/server/actions/images").uploadTradeImageAction;
let deleteTradeImageAction: typeof import("@/server/actions/images").deleteTradeImageAction;
let updateTradeImageCaptionAction: typeof import("@/server/actions/images").updateTradeImageCaptionAction;
let createTrade: typeof import("@/server/queries/trades").createTrade;

beforeAll(async () => {
  ({ wipe } = await bootstrapTestFirestore());
  ({ tradeImagesCollection } = await import("@/server/firebase/collections"));
  ({ uploadTradeImageAction, deleteTradeImageAction, updateTradeImageCaptionAction } = await import(
    "@/server/actions/images"
  ));
  ({ createTrade } = await import("@/server/queries/trades"));
});

beforeEach(async () => {
  await wipe();
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

async function seedImage(tradeId: string, filePath: string, caption: string | null) {
  const now = new Date().toISOString();
  const ref = tradeImagesCollection(tradeId).doc();
  const row = { id: ref.id, filePath, caption, createdAt: now };
  await ref.set(row);
  return row;
}

async function allImageRows(tradeId: string) {
  return (await tradeImagesCollection(tradeId).get()).docs.map((d) => d.data());
}

describe("uploadTradeImageAction", () => {
  it("saves the file to disk, creates a doc, and revalidates the trade's detail page", async () => {
    const trade = await makeTrade();
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "chart.png", { type: "image/png" }));
    fd.set("caption", "Entry setup");

    await uploadTradeImageAction(trade.id, fd);

    const [row] = await allImageRows(trade.id);
    expect(row).toMatchObject({ caption: "Entry setup" });
    expect(row!.filePath).toMatch(/\.png$/);
    expect(revalidatePath).toHaveBeenCalledWith(`/trades/${trade.id}`);
  });

  it("stores a null caption when none is provided", async () => {
    const trade = await makeTrade();
    const fd = new FormData();
    fd.set("file", new File([new Uint8Array([1, 2, 3])], "chart.png", { type: "image/png" }));

    await uploadTradeImageAction(trade.id, fd);

    const [row] = await allImageRows(trade.id);
    expect(row!.caption).toBeNull();
  });

  it("throws 'Please choose a file to upload.' when the file field is missing entirely", async () => {
    const trade = await makeTrade();
    const fd = new FormData();

    await expect(uploadTradeImageAction(trade.id, fd)).rejects.toThrow(
      "Please choose a file to upload.",
    );
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(await allImageRows(trade.id)).toEqual([]);
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
    expect(await allImageRows(trade.id)).toEqual([]);
  });
});

describe("deleteTradeImageAction", () => {
  it("deletes an existing image and revalidates the trade's detail page", async () => {
    const trade = await makeTrade();
    const image = await seedImage(trade.id, "does-not-exist-on-disk.png", "Entry");

    await deleteTradeImageAction(image.id, trade.id);

    expect(await allImageRows(trade.id)).toEqual([]);
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
    const image = await seedImage(trade.id, "a.png", null);

    await updateTradeImageCaptionAction(image.id, trade.id, "15m entry confirmation");

    const [row] = await allImageRows(trade.id);
    expect(row!.caption).toBe("15m entry confirmation");
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
