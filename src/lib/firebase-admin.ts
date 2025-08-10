
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';

// Note: `dotenv/config` is not needed here anymore as we are not using this file for server-side rendering in page components.
// The .env.local file is now primarily for local scripts like `seed.ts`.

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

let app: App | null = null;

// Initialize Firebase Admin SDK only if it's not already initialized
if (serviceAccountString && !getApps().length) {
    try {
        const serviceAccount = JSON.parse(serviceAccountString);
        app = initializeApp({
            credential: cert(serviceAccount),
        });
    } catch (e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT. Make sure it's a valid JSON string.", e);
    }
} else if (getApps().length > 0) {
    app = getApps()[0];
} else {
    if (process.env.NODE_ENV !== 'production') {
      console.warn("FIREBASE_SERVICE_ACCOUNT environment variable is not set. Firebase Admin SDK not initialized.");
    }
}


export const getAdminApp = () => {
    // This function can still be used by other server-side logic (like API routes or scripts),
    // but it won't be called by the dashboard page for rendering.
    if (!app) {
        return null;
    }
    return app;
};
