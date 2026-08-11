import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_PROJECT_ID ?? "gold-journal";

if (!getApps().length) {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    // Admin SDK auto-detects FIRESTORE_EMULATOR_HOST and skips auth entirely.
    initializeApp({ projectId });
  } else {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY is not set (and FIRESTORE_EMULATOR_HOST is not set, so this isn't the emulator).",
      );
    }
    initializeApp({
      credential: cert(JSON.parse(serviceAccountKey)),
      projectId,
    });
  }
}

export const db = getFirestore();
