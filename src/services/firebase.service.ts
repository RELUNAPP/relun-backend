import { readFileSync } from 'fs';
import { cert, initializeApp, getApps, App } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

/**
 * Firebase is only used to send FCM pushes to the native Android app.
 *
 * Configure with FIREBASE_SERVICE_ACCOUNT_PATH, the path to the service-account
 * JSON from Firebase console > Project settings > Service accounts. Without it,
 * FCM pushes are skipped with a warning and everything else keeps working.
 */
let app: App | null = null;
let attempted = false;

export const getFirebaseMessaging = (): Messaging | null => {
  if (!attempted) {
    attempted = true;
    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (keyPath) {
      try {
        const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
        app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
      } catch (error) {
        console.error('[firebase] Could not initialise from FIREBASE_SERVICE_ACCOUNT_PATH:', error);
      }
    }
  }

  return app ? getMessaging(app) : null;
};
