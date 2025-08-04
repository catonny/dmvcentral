
"use client";

import * as React from "react";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Task, Client, Engagement, EngagementStatus } from "@/lib/data";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";

export default function WorkflowPage() {
    const { user } = useAuth();
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [engagements, setEngagements] = React.useState<Engagement[]>([]);
    const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!user) return;
        setLoading(true);

        const fetchInitialData = async () => {
             const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
             const employeeSnapshot = await getDocs(employeeQuery);

             if (employeeSnapshot.empty) {
                 setLoading(false);
                 return;
             }
             const currentUser = { id: employeeSnapshot.docs[0].id, ...employeeSnapshot.docs[0].data() } as Employee;
             
             const clientsUnsub = onSnapshot(collection(db, "clients"), (snapshot) => {
                setClients(new Map(snapshot.docs.map(doc => [doc.id, doc.data() as Client])));
             });

             const activeStatuses: EngagementStatus[] = ["Pending", "Awaiting Documents", "In Process", "Partner Review"];
             const engagementsQuery = query(
                collection(db, "engagements"), 
                where("assignedTo", "array-contains", currentUser.id), 
                where("status", "in", activeStatuses)
            );
             const unsubEngagements = onSnapshot(engagementsQuery, (engagementsSnapshot) => {
                 const userEngagements = engagementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
                 setEngagements(userEngagements.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));

                 if (userEngagements.length > 0) {
                     const engagementIds = userEngagements.map(e => e.id);
                     const tasksQuery = query(collection(db, "tasks"), where("engagementId", "in", engagementIds));
                     const unsubTasks = onSnapshot(tasksQuery, (tasksSnapshot) => {
                         setTasks(tasksSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Task)));
                         setLoading(false);
                     }, () => setLoading(false));
                     return () => unsubTasks();
                 } else {
                     setTasks([]);
                     setLoading(false);
                 }
             }, () => setLoading(false));
             
             return () => {
                 unsubEngagements();
                 clientsUnsub();
             }
        }
        
        fetchInitialData();

    }, [user]);

    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> Loading Your Workflow...</div>;
    }

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">My Workflow</h2>
                    <p className="text-muted-foreground">
                        Select an engagement to view and manage its tasks.
                    </p>
                </div>
            </div>
            {engagements.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {engagements.map(engagement => {
                        const client = clients.get(engagement.clientId);
                        const engagementTasks = tasks.filter(t => t.engagementId === engagement.id);
                        const completedTasks = engagementTasks.filter(t => t.status === 'Completed').length;
                        const progress = engagementTasks.length > 0 ? (completedTasks / engagementTasks.length) * 100 : 0;
                        
                        return (
                            <Link href={`/workflow/${engagement.id}`} key={engagement.id}>
                                <Card className="h-full flex flex-col hover:border-primary/80 hover:shadow-lg transition-all">
                                    <CardHeader>
                                        <CardTitle className="text-lg">{engagement.remarks}</CardTitle>
                                        <CardDescription>{client?.Name || 'Loading client...'}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow">
                                        <div className="text-sm text-muted-foreground">
                                            {completedTasks} of {engagementTasks.length} tasks completed.
                                        </div>
                                        <Progress value={progress} className="mt-2" />
                                    </CardContent>
                                    <CardFooter>
                                        <p className={cn(
                                            "text-sm font-medium",
                                            isPast(new Date(engagement.dueDate)) ? "text-destructive" : "text-muted-foreground"
                                        )}>
                                            Due: {format(new Date(engagement.dueDate), "dd MMM, yyyy")}
                                        </p>
                                    </CardFooter>
                                </Card>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg">
                    <p className="text-lg font-semibold">All Caught Up!</p>
                    <p>You have no active engagements assigned to you.</p>
                </div>
            )}
        </div>
    )
}
