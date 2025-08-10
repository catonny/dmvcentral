
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';

let app: App | null = null;

// This function is designed to be run on the server, where environment variables are available.
if (!getApps().length) {
    const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // The private key needs to have its newlines escaped to be read from an env var.
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    // Check if all required service account properties are available
    if (serviceAccount.projectId && serviceAccount.clientEmail && serviceAccount.privateKey) {
        try {
            app = initializeApp({
                credential: cert(serviceAccount),
            });
        } catch (e) {
            console.error("Error initializing Firebase Admin SDK:", e);
        }
    } else {
        if (process.env.NODE_ENV !== 'production') {
            console.warn("Firebase Admin SDK credentials are not fully set in environment variables. Server-side Firebase features will be disabled.");
        }
    }
} else {
    app = getApps()[0];
}

export const getAdminApp = () => {
    return app;
};
