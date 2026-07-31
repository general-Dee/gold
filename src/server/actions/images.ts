"use server";

import { revalidatePath } from "next/cache";
import { validateUploadFile } from "@/lib/uploads";
import {
  deleteTradeImage,
  saveTradeImage,
  updateTradeImageCaption,
} from "@/server/queries/images";

export async function uploadTradeImageAction(tradeId: string, formData: FormData): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Please choose a file to upload.");

  const validationError = validateUploadFile(file);
  if (validationError) throw new Error(validationError);

  const buffer = Buffer.from(await file.arrayBuffer());
  const caption = (formData.get("caption") as string) || null;
  await saveTradeImage(tradeId, { fileName: file.name, buffer }, caption);

  revalidatePath(`/trades/${tradeId}`);
}

export async function deleteTradeImageAction(imageId: string, tradeId: string): Promise<void> {
  const result = await deleteTradeImage(imageId);
  if (!result) throw new Error("Image not found.");

  revalidatePath(`/trades/${tradeId}`);
}

export async function updateTradeImageCaptionAction(
  imageId: string,
  tradeId: string,
  caption: string,
): Promise<void> {
  const result = await updateTradeImageCaption(imageId, caption);
  if (!result) throw new Error("Image not found.");

  revalidatePath(`/trades/${tradeId}`);
}
