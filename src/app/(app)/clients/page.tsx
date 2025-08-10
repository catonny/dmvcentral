
import * as React from 'react';
import { getFirestore } from 'firebase-admin/firestore';
import type { Client, Employee, Department } from "@/lib/data";
import { ClientManager } from "@/components/client/client-manager";
import { getAdminApp } from '@/lib/firebase-admin';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

async function getClientData() {
    const adminApp = getAdminApp();
    if (!adminApp) {
        throw new Error("Firebase admin SDK not configured.");
    }
    const db = getFirestore(adminApp);
    
    try {
        const [clientsSnap, employeesSnap, departmentsSnap] = await Promise.all([
            db.collection('clients').get(),
            db.collection('employees').get(),
            db.collection('departments').get(),
        ]);

        const clients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        const departments = departmentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));

        return { clients, employees, departments };
    } catch (error) {
        console.error("Error fetching client data from Firestore:", error);
        throw new Error("Could not fetch data from Firestore.");
    }
}


export default async function ClientsPage() {
    try {
        const { clients, employees, departments } = await getClientData();
        return <ClientManager initialData={{ clients, employees, departments }} />;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertCircle /> Error Loading Clients
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>{errorMessage}</p>
                    <p className="text-sm text-muted-foreground mt-2">There was an issue loading client data from the server. Please check your Firebase configuration.</p>
                </CardContent>
            </Card>
        )
    }
}
