"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@/server/db/client";
import { tradeImages } from "@/server/db/schema";

const UPLOADS_DIR = path.join(process.cwd(), "data", "uploads");

export async function uploadTradeImageAction(tradeId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  await mkdir(UPLOADS_DIR, { recursive: true });

  const ext = path.extname(file.name) || "";
  const fileName = `${nanoid()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOADS_DIR, fileName), buffer);

  await db.insert(tradeImages).values({
    tradeId,
    filePath: fileName,
    caption: (formData.get("caption") as string) || null,
  });

  revalidatePath(`/trades/${tradeId}`);
}
