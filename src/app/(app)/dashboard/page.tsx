
import * as React from 'react';
import { db } from '@/lib/db';
import type { Client, Employee, Engagement, Task } from "@/lib/data";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

async function getDashboardData() {
    try {
        const [clientsResult, employeesResult, engagementsResult, tasksResult] = await Promise.all([
            db.query('SELECT * FROM clients'),
            db.query('SELECT * FROM employees'),
            db.query('SELECT * FROM engagements'),
            db.query('SELECT * FROM tasks'),
        ]);

        const clients = clientsResult.rows as Client[];
        const employees = employeesResult.rows as Employee[];
        const engagements = engagementsResult.rows as Engagement[];
        const tasks = tasksResult.rows as Task[];

        return { clients, employees, engagements, tasks };
    } catch (error) {
        console.error("Error fetching dashboard data from relational database:", error);
        throw new Error("Could not fetch data from the database. Ensure the database is running and credentials are set.");
    }
}

export default async function DashboardPage() {
    try {
        const { clients, employees, engagements, tasks } = await getDashboardData();
        return <DashboardClient clients={clients} employees={employees} engagements={engagements} tasks={tasks} />;
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
                    <p className="text-sm text-muted-foreground mt-2">There was an issue loading the dashboard data from the server. Please ensure your database is configured correctly.</p>
                </CardContent>
            </Card>
        )
    }
}
