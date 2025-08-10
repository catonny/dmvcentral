

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getDocs, collection, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAdminApp } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { auth } from "firebase-admin";
import type { Client, Employee, Engagement, EngagementStatus, Task } from "@/lib/data";

// This is now a server component that fetches data
export default async function DashboardPage() {
    
    // Check if the admin app is initialized
    if (!getAdminApp()) {
         return <DashboardClient serverData={null} error="Firebase Admin SDK not configured. Dashboard cannot load server-side data." />;
    }

    try {
        const session = cookies().get('session')?.value || '';
        const decodedIdToken = await auth().verifySessionCookie(session, true);
        const userEmail = decodedIdToken.email;

        const [
            clientsSnapshot,
            employeesSnapshot,
            engagementsSnapshot,
            tasksSnapshot,
        ] = await Promise.all([
            getDocs(collection(db, "clients")),
            getDocs(collection(db, "employees")),
            getDocs(query(collection(db, "engagements"), where("status", "in", ["Pending", "Awaiting Documents", "In Process", "Partner Review", "On Hold"]))),
            getDocs(collection(db, "tasks")),
        ]);
        
        const allClients = clientsSnapshot.docs.map(doc => doc.data() as Client);
        const allEmployees = employeesSnapshot.docs.map(doc => doc.data() as Employee);
        const allEngagements = engagementsSnapshot.docs.map(doc => doc.data() as Engagement);
        const allTasks = tasksSnapshot.docs.map(doc => doc.data() as Task);

        const currentUser = allEmployees.find(e => e.email === userEmail);
        
        const serverData = {
            clients: allClients,
            employees: allEmployees,
            engagements: allEngagements,
            tasks: allTasks,
            currentUser: currentUser || null,
        }

        return <DashboardClient serverData={serverData} />;

    } catch (error) {
        console.error("Error fetching data in DashboardPage:", error);
        // This will render the client component with an error state,
        // which can then show a helpful message to the user.
        return <DashboardClient serverData={null} error="Failed to fetch dashboard data. You may not be logged in." />;
    }
}
