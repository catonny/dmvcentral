
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import 'dotenv/config';

// This will be automatically populated by the Firebase environment
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : undefined;

let app: App;

// Initialize Firebase Admin SDK
if (!getApps().length) {
  if (!serviceAccount) {
    throw new Error('Firebase Admin SDK service account is not defined. Make sure the FIREBASE_SERVICE_ACCOUNT environment variable is set.');
  }
  app = initializeApp({
    credential: cert(serviceAccount),
  });
} else {
  app = getApps()[0];
}

export const getAdminApp = () => app;
