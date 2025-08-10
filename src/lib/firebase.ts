// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, doc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import type { ActivityLogType, Employee, Engagement } from "./data";
import { db as pgDb } from './db'; // Import the pg pool

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDPFFxrzCOn7Y2Ab3_AVKUmBsIbyJbeYMQ",
  authDomain: "dmv-central.firebaseapp.com",
  projectId: "dmv-central",
  storageBucket: "dmv-central.firebasestorage.app",
  messagingSenderId: "894272146644",
  appId: "1:894272146644:web:17b286582b853b4194ff41",
  measurementId: "G-WDGC02SJ92"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// Initialize Analytics only in the browser
if (typeof window !== 'undefined') {
    getAnalytics(app);
}

interface LogActivityOptions {
    engagement: Engagement;
    type: ActivityLogType;
    user: Employee;
    details: {
        from?: string;
        to?: string;
        taskName?: string;
    };
}

export const logActivity = async ({ engagement, type, user, details }: LogActivityOptions) => {
    try {
        const queryText = `
            INSERT INTO activity_log (engagement_id, client_id, type, user_id, user_name, details)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        const values = [
            engagement.id,
            engagement.clientId,
            type,
            user.id,
            user.name,
            {
                engagementName: engagement.remarks,
                ...details,
            },
        ];
        await pgDb.query(queryText, values);
    } catch (error) {
        console.error("Failed to log activity to PostgreSQL:", error);
    }
}

export { app, db, auth };
