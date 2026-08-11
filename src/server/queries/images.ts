import { unlink, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tradeImagesCollection, type TradeImage } from "@/server/firebase/collections";
import { nanoid } from "@/server/firebase/ids";
import { UPLOADS_DIR } from "@/server/uploadsDir";

export async function saveTradeImage(
  tradeId: string,
  file: { fileName: string; buffer: Buffer },
  caption: string | null,
): Promise<TradeImage> {
  await mkdir(UPLOADS_DIR, { recursive: true });

  const ext = path.extname(file.fileName) || "";
  const filePath = `${nanoid()}${ext}`;
  await writeFile(path.join(UPLOADS_DIR, filePath), file.buffer);

  const row: TradeImage = { id: nanoid(), filePath, caption, createdAt: new Date().toISOString() };
  await tradeImagesCollection(tradeId).doc(row.id).set(row);
  return row;
}

// tradeId is required to address the images subcollection (trades/{id}/images)
// directly — callers (the images actions) already have it in scope from the
// page they're called from, so this avoids an all-trades scan to locate it.
export async function deleteTradeImage(
  tradeId: string,
  imageId: string,
): Promise<{ tradeId: string } | null> {
  const ref = tradeImagesCollection(tradeId).doc(imageId);
  const doc = await ref.get();
  if (!doc.exists) return null;
  const image = doc.data()!;

  await ref.delete();

  try {
    await unlink(path.join(UPLOADS_DIR, image.filePath));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  return { tradeId };
}

export async function updateTradeImageCaption(
  tradeId: string,
  imageId: string,
  caption: string | null,
): Promise<{ tradeId: string; caption: string | null } | null> {
  const ref = tradeImagesCollection(tradeId).doc(imageId);
  const doc = await ref.get();
  if (!doc.exists) return null;

  const trimmedCaption = caption?.trim() || null;
  await ref.update({ caption: trimmedCaption });
  return { tradeId, caption: trimmedCaption };
}
