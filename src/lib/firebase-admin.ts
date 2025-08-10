
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import * as serviceAccount from './secret.json';

let app: App | null = null;

// Check if serviceAccount has valid credentials before initializing
const hasCredentials = serviceAccount && (serviceAccount as any).type === 'service_account';

if (!getApps().length && hasCredentials) {
    try {
        app = initializeApp({
            credential: cert(serviceAccount),
        });
    } catch (e) {
        console.error("Error initializing Firebase Admin SDK:", e);
        // Set app to null if initialization fails to prevent usage
        app = null;
    }
} else if (getApps().length > 0) {
    app = getApps()[0];
}

export const getAdminApp = () => {
    // Return null if the SDK wasn't initialized
    if (!app) {
        console.warn("Firebase Admin SDK not initialized. This may be intentional if you are using an alternative database.");
    }
    return app;
};
