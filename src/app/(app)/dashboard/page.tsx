

"use client";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Employee, Client, Engagement, Task } from "@/lib/data";
import { useEffect, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// This is now a client component that fetches data
export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const [serverData, setServerData] = useState<{
        clients: Client[];
        employees: Employee[];
        engagements: Engagement[];
        tasks: Task[];
        currentUser: Employee | null;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setLoading(false);
            setError("You are not logged in.");
            return;
        }

        const unsubs: (() => void)[] = [];

        const fetchData = async () => {
            try {
                const employeesSnapshot = await getDocs(collection(db, "employees"));
                const allEmployees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
                const currentUserProfile = allEmployees.find(e => e.email === user.email);

                if (!currentUserProfile) {
                    setError("Could not find your employee profile.");
                    setLoading(false);
                    return;
                }
                
                const clientsQuery = query(collection(db, "clients"));
                unsubs.push(onSnapshot(clientsQuery, (snap) => {
                    const clients = snap.docs.map(doc => doc.data() as Client);
                    setServerData(prev => ({...prev!, clients}));
                }));

                const engagementsQuery = query(collection(db, "engagements"));
                 unsubs.push(onSnapshot(engagementsQuery, (snap) => {
                    const engagements = snap.docs.map(doc => doc.data() as Engagement);
                    setServerData(prev => ({...prev!, engagements}));
                }));
                
                 unsubs.push(onSnapshot(collection(db, "tasks"), (snap) => {
                    const tasks = snap.docs.map(doc => doc.data() as Task);
                    setServerData(prev => ({ ...prev!, tasks, employees: allEmployees, currentUser: currentUserProfile, loading: false }));
                    setLoading(false);
                }));

            } catch (err) {
                console.error("Error fetching dashboard data:", err);
                setError("Failed to fetch dashboard data.");
                setLoading(false);
            }
        };

        fetchData();

        return () => {
            unsubs.forEach(unsub => unsub());
        };

    }, [user, authLoading]);

    if (loading || authLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (error && !serverData) {
         return (
             <Card>
                <CardHeader>
                    <CardTitle>Dashboard Error</CardTitle>
                    <CardDescription>{error}</CardDescription>
                </CardHeader>
             </Card>
         )
    }

    return <DashboardClient serverData={serverData} />;
}
