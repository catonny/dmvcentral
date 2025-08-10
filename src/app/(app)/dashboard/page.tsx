

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import type { Client, Employee, Engagement, Task } from "@/lib/data";

async function getDashboardData() {
    const adminApp = getAdminApp();
    if (!adminApp) {
        // Return empty arrays if the admin app isn't initialized
        // This prevents the app from crashing on the server.
        return {
            clients: [],
            engagements: [],
            tasks: [],
            allEmployees: [],
        };
    }
    const db = getFirestore(adminApp);
    
    try {
        const [clientsSnap, engagementsSnap, tasksSnap, employeesSnap] = await Promise.all([
            db.collection("clients").get(),
            db.collection("engagements").where("status", "in", ["Pending", "Awaiting Documents", "In Process", "Partner Review", "On Hold"]).get(),
            db.collection("tasks").get(),
            db.collection("employees").get(),
        ]);

        return {
            clients: clientsSnap.docs.map(doc => doc.data() as Client),
            engagements: engagementsSnap.docs.map(doc => doc.data() as Engagement),
            tasks: tasksSnap.docs.map(doc => doc.data() as Task),
            allEmployees: employeesSnap.docs.map(doc => doc.data() as Employee),
        };
    } catch (error) {
        console.error("Error fetching dashboard data on server:", error);
        // On failure, return empty arrays to allow the page to render.
        return {
            clients: [],
            engagements: [],
            tasks: [],
            allEmployees: [],
        };
    }
}


export default async function DashboardPage() {
    const initialData = await getDashboardData();
    return (
        <DashboardClient initialData={initialData} />
    )
}
