import { unlink, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/server/db/client";
import { tradeImages } from "@/server/db/schema";
import { UPLOADS_DIR } from "@/server/uploadsDir";

export async function saveTradeImage(
  tradeId: string,
  file: { fileName: string; buffer: Buffer },
  caption: string | null,
) {
  await mkdir(UPLOADS_DIR, { recursive: true });

  const ext = path.extname(file.fileName) || "";
  const filePath = `${nanoid()}${ext}`;
  await writeFile(path.join(UPLOADS_DIR, filePath), file.buffer);

  const [row] = await db
    .insert(tradeImages)
    .values({ tradeId, filePath, caption })
    .returning();
  return row;
}

export async function deleteTradeImage(imageId: string): Promise<{ tradeId: string } | null> {
  const [image] = await db.select().from(tradeImages).where(eq(tradeImages.id, imageId));
  if (!image) return null;

  await db.delete(tradeImages).where(eq(tradeImages.id, imageId));

  try {
    await unlink(path.join(UPLOADS_DIR, image.filePath));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  return { tradeId: image.tradeId };
}

export async function updateTradeImageCaption(
  imageId: string,
  caption: string | null,
): Promise<{ tradeId: string; caption: string | null } | null> {
  const [row] = await db
    .update(tradeImages)
    .set({ caption: caption?.trim() || null })
    .where(eq(tradeImages.id, imageId))
    .returning();
  if (!row) return null;
  return { tradeId: row.tradeId, caption: row.caption };
}
