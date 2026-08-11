import { customAlphabet } from "nanoid";

// GCP/Firestore project IDs must be lowercase letters, digits, and hyphens only.
// Plain nanoid()'s default alphabet includes uppercase and `_`, which the emulator
// rejects with a 400 ("Invalid project ID") — nearly every call, since a random
// 10-char id from a 64-char alphabet has under a 1% chance of avoiding both.
const randomProjectIdSuffix = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

/**
 * Points the Firebase Admin client at a fresh, throwaway Firestore emulator
 * project and returns db + a wipe() helper for the caller's own fixtures.
 * Call once per test file, in beforeAll.
 *
 * Every test file gets its own emulator projectId (the emulator's
 * singleProjectMode:false, set in firebase.json, allows any projectId to be
 * used against the same running emulator). This is what makes Vitest's
 * default parallel-file execution safe here: unlike a single shared project
 * wiped between tests, concurrent files can never see or clobber each
 * other's documents, because each file is its own isolated Firestore
 * namespace. Within a file, wipe() (called from beforeEach/afterEach) still
 * clears documents between tests, safely, since that project belongs to
 * this file alone.
 *
 * Vitest's default pool (forks, isolate: true) gives each test file its own
 * module registry, so setting FIREBASE_PROJECT_ID before dynamically
 * importing "@/server/firebase/client" here yields a client bound to this
 * file's own project — no risk of state leaking between test files.
 */
export async function bootstrapTestFirestore() {
  const projectId = `test-${randomProjectIdSuffix()}`;
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
  process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;
  process.env.FIREBASE_PROJECT_ID = projectId;

  const { db } = await import("@/server/firebase/client");

  async function wipe() {
    const url = `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`;
    const response = await fetch(url, { method: "DELETE" });
    if (!response.ok) {
      throw new Error(`Failed to wipe emulator project ${projectId}: ${response.status}`);
    }
  }

  return { db, projectId, wipe };
}
