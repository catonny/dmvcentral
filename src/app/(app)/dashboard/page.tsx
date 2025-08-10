
import * as React from 'react';
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from 'firebase-admin/firestore';
import type { Client, Employee, Engagement, Task } from "@/lib/data";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

async function getDashboardData() {
    const adminApp = getAdminApp();
    if (!adminApp) {
        throw new Error("Firebase admin SDK not configured.");
    }

    const db = getFirestore(adminApp);
    
    try {
        const [clientsSnap, employeesSnap, engagementsSnap, tasksSnap] = await Promise.all([
            db.collection('clients').get(),
            db.collection('employees').get(),
            db.collection('engagements').get(),
            db.collection('tasks').get(),
        ]);

        const clients = clientsSnap.docs.map(doc => doc.data() as Client);
        const employees = employeesSnap.docs.map(doc => doc.data() as Employee);
        const engagements = engagementsSnap.docs.map(doc => doc.data() as Engagement);
        const tasks = tasksSnap.docs.map(doc => doc.data() as Task);

        return { clients, employees, engagements, tasks };
    } catch (error) {
        console.error("Error fetching dashboard data from Firestore:", error);
        throw new Error("Could not fetch data from Firestore.");
    }
}

export default async function DashboardPage() {
    try {
        const { clients, employees, engagements, tasks } = await getDashboardData();
        return <DashboardClient initialData={{ clients, employees, engagements, tasks }} />;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return (
             <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertCircle /> Dashboard Error
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>{errorMessage}</p>
                    <p className="text-sm text-muted-foreground mt-2">There was an issue loading the dashboard data from the server. Please ensure your Firebase Admin SDK is configured correctly.</p>
                </CardContent>
            </Card>
        )
    }
}
