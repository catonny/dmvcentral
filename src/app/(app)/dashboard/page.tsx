

import * as React from 'react';
import { getFirestore, collection, getDocs } from 'firebase-admin/firestore';
import { getAdminApp } from '@/lib/firebase-admin';
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

async function getDashboardData() {
    const adminApp = getAdminApp();
    if (!adminApp) {
        throw new Error("Firebase admin SDK not configured.");
    }

    const db = getFirestore(adminApp);
    const [clientsSnap, employeesSnap, engagementsSnap, tasksSnap] = await Promise.all([
        getDocs(collection(db, 'clients')),
        getDocs(collection(db, 'employees')),
        getDocs(collection(db, 'engagements')),
        getDocs(collection(db, 'tasks')),
    ]);

    const clients = clientsSnap.docs.map(doc => doc.data());
    const employees = employeesSnap.docs.map(doc => doc.data());
    const engagements = engagementsSnap.docs.map(doc => doc.data());
    const tasks = tasksSnap.docs.map(doc => doc.data());
    
    return { clients, employees, engagements, tasks };
}


export default async function DashboardPage() {
    try {
        const { clients, employees, engagements, tasks } = await getDashboardData();
        return <DashboardClient initialData={{ clients, employees, engagements, tasks }} />;
    } catch (error: any) {
        console.error("Error fetching dashboard data:", error);
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertCircle /> Dashboard Error
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>{error.message}</p>
                    <p className="mt-2 text-sm text-muted-foreground">There was an issue loading the dashboard data from the server. Please ensure your Firebase Admin SDK is configured correctly in your environment variables.</p>
                </CardContent>
            </Card>
        );
    }
}
