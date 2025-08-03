
import 'dotenv/config';
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import type { Client, Employee, Engagement } from "@/lib/data";
import { getAdminApp } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { collection, getDocs, query } from "firebase/firestore";
import { cookies } from "next/headers";
import { db } from "@/lib/firebase";


async function getDashboardData() {
    const session = cookies().get("session")?.value || "";

    if (!session) {
        return {
            allClients: [],
            allEmployees: [],
            engagements: [],
            currentUserEmployeeProfile: null,
            error: "Not authenticated"
        };
    }
    
    try {
        const adminApp = await getAdminApp();
        const auth = getAuth(adminApp);
        const decodedClaims = await auth.verifySessionCookie(session, true);
        const userEmail = decodedClaims.email;

        const employeeQuery = query(collection(db, "employees"));
        const clientsQuery = query(collection(db, "clients"));
        const engagementsQuery = query(collection(db, "engagements"));

        const [employeeSnapshot, clientsSnapshot, engagementsSnapshot] = await Promise.all([
            getDocs(employeeQuery),
            getDocs(clientsQuery),
            getDocs(engagementsQuery),
        ]);
        
        const allEmployees = employeeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        const allClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        const engagements = engagementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));

        const currentUserEmployeeProfile = allEmployees.find(s => s.email === userEmail) || null;

        return { allClients, allEmployees, engagements, currentUserEmployeeProfile, error: null };
    } catch (error) {
        console.error("Error fetching server-side dashboard data:", error);
        return {
            allClients: [],
            allEmployees: [],
            engagements: [],
            currentUserEmployeeProfile: null,
            error: "Failed to fetch data"
        };
    }
}


export default async function DashboardPage() {
    const { allClients, allEmployees, engagements, currentUserEmployeeProfile, error } = await getDashboardData();
    
    if (error) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <p className="text-destructive">Error: {error}. Please try logging in again.</p>
            </div>
        );
    }
    
    return (
        <DashboardClient
            initialAllClients={allClients}
            initialAllEmployees={allEmployees}
            initialEngagements={engagements}
            initialCurrentUserEmployeeProfile={currentUserEmployeeProfile}
        />
    )
}
