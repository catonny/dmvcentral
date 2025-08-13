

// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, doc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import type { ActivityLogType, Client, Employee, Engagement, Todo, Notification, NotificationType } from "./data";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
    engagement?: Engagement;
    clientId?: string; // Make clientId optional to handle general logs
    type: ActivityLogType;
    user: Employee;
    details: {
        engagementName?: string;
        from?: string;
        to?: string;
        taskName?: string;
        noteText?: string;
        eventName?: string;
    };
}

export const logActivity = async ({ engagement, clientId, type, user, details }: LogActivityOptions) => {
    try {
        const logRef = doc(collection(db, 'activityLog'));
        const logData: any = {
            id: logRef.id,
            clientId: engagement?.clientId || clientId || "general",
            type,
            timestamp: new Date().toISOString(),
            userId: user.id,
            userName: user.name,
            details: {
                engagementName: engagement?.remarks || details.engagementName,
                ...details,
            },
        };

        if (engagement?.id) {
            logData.engagementId = engagement.id;
        }

        await setDoc(logRef, logData);
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
}

interface NotifyOptions {
    recipients: string[]; // User IDs
    type: NotificationType;
    text: string;
    relatedEntity: Notification['relatedEntity'];
    triggeringUser: Employee;
}

export const notify = async ({ recipients, type, text, relatedEntity, triggeringUser }: NotifyOptions) => {
    const uniqueRecipients = new Set(recipients.filter(id => id !== triggeringUser.id)); // Don't notify the user who triggered the action

    for (const userId of uniqueRecipients) {
        try {
            const notificationRef = doc(collection(db, "notifications"));
            const newNotification: Notification = {
                id: notificationRef.id,
                userId,
                type,
                text,
                relatedEntity,
                isRead: false,
                createdAt: new Date().toISOString(),
                createdBy: triggeringUser.id,
            };
            await setDoc(notificationRef, newNotification);
        } catch (error) {
            console.error(`Failed to create notification for user ${userId}:`, error);
        }
    }
};

export { app, db, auth };
