import type { WriteBatch } from "firebase-admin/firestore";
import { db } from "./client";

/** Builds and commits a Firestore batch in one call. */
export async function runBatch(fn: (batch: WriteBatch) => void): Promise<void> {
  const batch = db.batch();
  fn(batch);
  await batch.commit();
}
