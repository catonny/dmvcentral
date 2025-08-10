

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { collection, query, getDocs } from "firebase/firestore";
import { getFirestore } from 'firebase-admin/firestore';
import type { Client, Employee, Engagement, Task } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getAdminApp } from "@/lib/firebase-admin";

async function getDashboardData() {
    const adminApp = getAdminApp();
    if (!adminApp) {
        throw new Error("Firebase admin SDK not configured.");
    }
    const db = getFirestore(adminApp);

    try {
        const [clientsSnap, employeesSnap, engagementsSnap, tasksSnap] = await Promise.all([
            getDocs(collection(db, "clients")),
            getDocs(collection(db, "employees")),
            getDocs(collection(db, "engagements")),
            getDocs(collection(db, "tasks")),
        ]);

        const clients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        const engagements = engagementsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
        const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));

        return { clients, employees, engagements, tasks };
    } catch (error) {
        console.error("Error fetching data on server:", error);
        // This will be caught by the error boundary
        throw new Error("Failed to fetch dashboard data from server.");
    }
}


export default async function DashboardPage() {
    try {
        const { clients, employees, engagements, tasks } = await getDashboardData();
        return (
            <DashboardClient 
                serverData={{ clients, employees, engagements, tasks }} 
            />
        );
    } catch (error) {
         const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
         return (
             <Card>
                <CardHeader>
                    <CardTitle>Dashboard Error</CardTitle>
                    <CardDescription>{errorMessage}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p>There was an issue loading the dashboard data from the server. Please ensure your Firebase Admin SDK is configured correctly in your environment variables.</p>
                </CardContent>
             </Card>
         )
    }
}
