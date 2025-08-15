// functions/src/firebase.ts
import * as admin from "firebase-admin";

/**
 * Initializes the Firebase Admin SDK if it hasn't been already.
 * This check prevents re-initialization errors during hot-reloads in an emulator.
 */
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * The initialized Firestore database instance.
 * Exported for use in other modules.
 */
export const db = admin.firestore();

/**
 * The Firestore Timestamp object.
 * Exported for use in other modules.
 */
export const Timestamp = admin.firestore.Timestamp;
export const FieldValue = admin.firestore.FieldValue;
