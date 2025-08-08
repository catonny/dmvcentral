
"use client";

import * as React from "react";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Task, Client, Engagement, EngagementStatus, Employee } from "@/lib/data";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

function EngagementGrid({ engagements, tasks, clients }: { engagements: Engagement[], tasks: Task[], clients: Map<string, Client> }) {
    if (engagements.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8 border-2 border-dashed rounded-lg mt-4">
                <p className="text-lg font-semibold">All Caught Up!</p>
                <p>There are no engagements in this section.</p>
            </div>
        )
    }

    return (
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
                                <CardTitle className="text-lg">{client?.Name || 'Loading client...'}</CardTitle>
                                <CardDescription>{engagement.remarks}</CardDescription>
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
    )
}

export default function WorkflowPage() {
    const { user } = useAuth();
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [myEngagements, setMyEngagements] = React.useState<Engagement[]>([]);
    const [teamEngagements, setTeamEngagements] = React.useState<Engagement[]>([]);
    const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<Employee | null>(null);

    React.useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }
        setLoading(true);

        const fetchInitialData = async () => {
             try {
                const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
                const employeeSnapshot = await getDocs(employeeQuery);

                if (employeeSnapshot.empty) {
                    setLoading(false);
                    return;
                }
                const currentUserProfile = { id: employeeSnapshot.docs[0].id, ...employeeSnapshot.docs[0].data() } as Employee;
                setCurrentUser(currentUserProfile);
                
                const clientsUnsub = onSnapshot(collection(db, "clients"), (snapshot) => {
                   setClients(new Map(snapshot.docs.map(doc => [doc.id, doc.data() as Client])));
                });

                const activeStatuses: EngagementStatus[] = ["Pending", "Awaiting Documents", "In Process", "Partner Review", "On Hold"];
                
                // Fetch engagements assigned to me
                const myEngagementsQuery = query(
                   collection(db, "engagements"), 
                   where("assignedTo", "array-contains", currentUserProfile.id), 
                   where("status", "in", activeStatuses)
               );
                const unsubMyEngagements = onSnapshot(myEngagementsQuery, (engagementsSnapshot) => {
                    const userEngagements = engagementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
                    setMyEngagements(userEngagements.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
                    setLoading(false); // Can set loading to false after personal engagements load
                }, () => setLoading(false));
                
                 // Fetch engagements reported to me
                const teamEngagementsQuery = query(
                   collection(db, "engagements"), 
                   where("reportedTo", "==", currentUserProfile.id), 
                   where("status", "in", activeStatuses)
               );
                const unsubTeamEngagements = onSnapshot(teamEngagementsQuery, (engagementsSnapshot) => {
                    const supervisedEngagements = engagementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
                    setTeamEngagements(supervisedEngagements.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
                });


                const allEngagementIds = [...myEngagements.map(e => e.id), ...teamEngagements.map(e => e.id)];
                if (allEngagementIds.length > 0) {
                     const tasksQuery = query(collection(db, "tasks"), where("engagementId", "in", allEngagementIds));
                     const unsubTasks = onSnapshot(tasksQuery, (tasksSnapshot) => {
                        setTasks(tasksSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Task)));
                     });
                      return () => {
                        unsubMyEngagements();
                        unsubTeamEngagements();
                        clientsUnsub();
                        unsubTasks();
                    }
                } else {
                    setTasks([]);
                }

                return () => {
                    unsubMyEngagements();
                    unsubTeamEngagements();
                    clientsUnsub();
                }

             } catch(error) {
                 console.error("Error fetching workflow data:", error)
                 setLoading(false)
             }
        }
        
        fetchInitialData();

    }, [user, teamEngagements, myEngagements]);

    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> Loading Your Workflow...</div>;
    }

    const showTeamSection = currentUser && (currentUser.role.includes("Partner") || currentUser.role.includes("Manager"));

    return (
        <div className="flex h-full flex-col space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight font-headline">My Engagements</h2>
                <p className="text-muted-foreground">
                    Engagements and tasks directly assigned to you.
                </p>
                <EngagementGrid engagements={myEngagements} tasks={tasks} clients={clients} />
            </div>

            {showTeamSection && (
                 <>
                    <Separator />
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight font-headline">Team Engagements</h2>
                        <p className="text-muted-foreground">
                           Engagements you are supervising.
                        </p>
                       <EngagementGrid engagements={teamEngagements} tasks={tasks} clients={clients} />
                    </div>
                </>
            )}
        </div>
    )
}
