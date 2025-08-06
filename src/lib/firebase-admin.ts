
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import 'dotenv/config';

// This will be automatically populated by the Firebase environment
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountString) {
    throw new Error('Firebase Admin SDK service account is not defined or is invalid. Make sure the FIREBASE_SERVICE_ACCOUNT environment variable is set correctly.');
}

const serviceAccount = JSON.parse(serviceAccountString);

let app: App;

// Initialize Firebase Admin SDK
if (!getApps().length) {
  app = initializeApp({
    credential: cert(serviceAccount),
  });
} else {
  app = getApps()[0];
}

export const getAdminApp = () => app;
