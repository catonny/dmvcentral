
import * as React from 'react';
import { db } from '@/lib/db';
import type { Client, Employee, Department } from "@/lib/data";
import { ClientManager } from "@/components/client/client-manager";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

async function getClientData() {
    try {
        const [clientsResult, employeesResult, departmentsResult] = await Promise.all([
            db.query('SELECT * FROM clients'),
            db.query('SELECT * FROM employees'),
            db.query('SELECT * FROM departments'),
        ]);

        const clients = clientsResult.rows as Client[];
        const employees = employeesResult.rows as Employee[];
        const departments = departmentsResult.rows as Department[];

        return { clients, employees, departments };
    } catch (error) {
        console.error("Error fetching client data from relational database:", error);
        throw new Error("Could not fetch data from the database. Ensure the database is running and credentials are set.");
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
                    <p className="text-sm text-muted-foreground mt-2">There was an issue loading client data from the server. Please check your database connection.</p>
                </CardContent>
            </Card>
        )
    }
}
