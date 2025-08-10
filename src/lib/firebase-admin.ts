
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import * as serviceAccount from './secret.json';

let app: App | null = null;

if (!getApps().length) {
    try {
        app = initializeApp({
            credential: cert(serviceAccount),
        });
    } catch (e) {
        console.error("Error initializing Firebase Admin SDK:", e);
    }
} else {
    app = getApps()[0];
}

export const getAdminApp = () => {
    return app;
};
