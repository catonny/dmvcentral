

import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import 'dotenv/config';

// This will be automatically populated by the Firebase environment
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

let app: App | null = null;

// Initialize Firebase Admin SDK only if the service account is available
if (serviceAccountString) {
    try {
        const serviceAccount = JSON.parse(serviceAccountString);
        if (!getApps().length) {
          app = initializeApp({
            credential: cert(serviceAccount),
          });
        } else {
          app = getApps()[0];
        }
    } catch (e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT. Make sure it's a valid JSON string.", e);
    }
} else {
    // In a production or Vercel environment, you might want to log this differently
    // or rely on the environment being correctly set up. For local dev, this is a helpful warning.
    if (process.env.NODE_ENV !== 'production') {
      console.warn("FIREBASE_SERVICE_ACCOUNT environment variable is not set. Firebase Admin SDK not initialized.");
    }
}


export const getAdminApp = () => {
    if (!app) {
        // This function will now return null if the admin app isn't initialized,
        // allowing parts of the app to proceed without crashing.
        return null;
    }
    return app;
};
