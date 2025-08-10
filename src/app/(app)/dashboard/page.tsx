
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "firebase-admin";
import { getAdminApp } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import type { Client, Employee, Engagement, Task } from "@/lib/data";


async function getDashboardData() {
  try {
    const adminApp = getAdminApp();
    if (!adminApp) {
        console.warn("Admin SDK not initialized. Skipping server-side auth check.");
        return { allClients: [], allEngagements: [], allEmployees: [], allTasks: [], currentUser: null };
    }

    const sessionCookie = cookies().get("session")?.value || "";
    // If there's no session cookie, we can't authenticate on the server.
    if (!sessionCookie) {
         return { allClients: [], allEngagements: [], allEmployees: [], allTasks: [], currentUser: null };
    }

    const decodedToken = await auth(adminApp).verifySessionCookie(sessionCookie, true);
    
    if (!decodedToken.email) {
      return null;
    }

    const employeeQuery = query(collection(db, "employees"), where("email", "==", decodedToken.email));
    const [
        profileSnapshot,
        clientsSnapshot,
        engagementsSnapshot,
        employeesSnapshot,
        tasksSnapshot
    ] = await Promise.all([
        getDocs(employeeQuery),
        getDocs(collection(db, "clients")),
        getDocs(query(collection(db, "engagements"), where("status", "in", ["Pending", "Awaiting Documents", "In Process", "Partner Review", "On Hold"]))),
        getDocs(collection(db, "employees")),
        getDocs(collection(db, "tasks"))
    ]);

    const allClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
    const allEngagements = engagementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
    const allEmployees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
    const allTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));

    if (profileSnapshot.empty) {
      return { allClients, allEngagements, allEmployees, allTasks, currentUser: null };
    }

    const currentUser = { id: profileSnapshot.docs[0].id, ...profileSnapshot.docs[0].data() } as Employee;
    
    return { allClients, allEngagements, allEmployees, allTasks, currentUser };
    
  } catch (error) {
    // This can happen if the cookie is expired or invalid.
    // We'll return null and let the client-side handle redirection.
    if ((error as any).code === 'auth/session-cookie-expired' || (error as any).code === 'auth/session-cookie-revoked') {
      return null;
    }
    console.error("Error fetching dashboard data on server:", error);
    return null;
  }
}


export default async function DashboardPage() {
    const initialData = await getDashboardData();
    
    return (
        <DashboardClient initialData={initialData} />
    )
}
