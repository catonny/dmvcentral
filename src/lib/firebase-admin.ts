
import * as admin from 'firebase-admin';

// This will be automatically populated by the Firebase environment
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : undefined;

let app: admin.app.App;

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  if (!serviceAccount) {
    throw new Error('Firebase Admin SDK service account is not defined. Make sure the FIREBASE_SERVICE_ACCOUNT environment variable is set.');
  }
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} else {
  app = admin.app();
}

export const getAdminApp = () => app;
