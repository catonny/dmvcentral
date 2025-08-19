
"use client";

import * as React from "react";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Task, Client, Engagement, EngagementStatus, Employee, EngagementType } from "@/lib/data";
import { ChevronRight, Loader2, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { TeamEngagementList } from "@/components/workflow/team-engagement-list";

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
                                <CardTitle className="text-lg">{client?.name || 'Loading client...'}</CardTitle>
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
    const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [teamLoading, setTeamLoading] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<Employee | null>(null);
    const [isTeamSectionExpanded, setIsTeamSectionExpanded] = React.useState(false);
    const [teamView, setTeamView] = React.useState<'grid' | 'list'>('grid');

    React.useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        let unsubs: (() => void)[] = [];

        const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
        const unsubUser = onSnapshot(employeeQuery, (employeeSnapshot) => {
            if (employeeSnapshot.empty) {
                setLoading(false);
                setCurrentUser(null);
                return;
            }
            
            const currentUserProfile = { id: employeeSnapshot.docs[0].id, ...employeeSnapshot.docs[0].data() } as Employee;
            setCurrentUser(currentUserProfile);
            
            // Unsubscribe from previous engagement listeners if user changes
            unsubs.forEach(unsub => unsub());
            unsubs = [];

            // Setup listeners for new user
            const clientsUnsub = onSnapshot(collection(db, "clients"), (snapshot) => 
                setClients(new Map(snapshot.docs.map(doc => [doc.id, doc.data() as Client])))
            );
            unsubs.push(clientsUnsub);

            const engagementTypesUnsub = onSnapshot(collection(db, "engagementTypes"), (snapshot) => 
                setEngagementTypes(snapshot.docs.map(doc => doc.data() as EngagementType))
            );
            unsubs.push(engagementTypesUnsub);

            const allTasksUnsub = onSnapshot(collection(db, "tasks"), (snapshot) =>
                setTasks(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Task)))
            );
            unsubs.push(allTasksUnsub);

            const activeStatuses: EngagementStatus[] = ["Pending", "Awaiting Documents", "In Process", "Partner Review", "On Hold"];
            const myEngagementsQuery = query(
               collection(db, "engagements"), 
               where("assignedTo", "array-contains", currentUserProfile.id), 
               where("status", "in", activeStatuses)
            );
            const myEngagementsUnsub = onSnapshot(myEngagementsQuery, (engagementsSnapshot) => {
                const userEngagements = engagementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
                setMyEngagements(userEngagements.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
                setLoading(false);
            });
            unsubs.push(myEngagementsUnsub);
        });

        unsubs.push(unsubUser);

        return () => {
            unsubs.forEach(unsub => unsub());
        };
    }, [user]);

    // Fetch team engagements only when the section is expanded
    React.useEffect(() => {
        if (!isTeamSectionExpanded || !currentUser || teamEngagements.length > 0) return;

        setTeamLoading(true);
        const activeStatuses: EngagementStatus[] = ["Pending", "Awaiting Documents", "In Process", "Partner Review", "On Hold"];

        const teamEngagementsQuery = query(
            collection(db, "engagements"), 
            where("reportedTo", "==", currentUser.id), 
            where("status", "in", activeStatuses)
        );

        const unsubTeamEngagements = onSnapshot(teamEngagementsQuery, (engagementsSnapshot) => {
            const supervisedEngagements = engagementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
            setTeamEngagements(supervisedEngagements.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
            setTeamLoading(false);
        }, () => setTeamLoading(false));

        return () => unsubTeamEngagements();

    }, [isTeamSectionExpanded, currentUser, teamEngagements]);

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
                     <Collapsible open={isTeamSectionExpanded} onOpenChange={setIsTeamSectionExpanded}>
                        <CollapsibleTrigger className="w-full text-left group">
                            <div className="flex items-center gap-2 p-2 -ml-2 rounded-lg hover:bg-muted">
                                <ChevronRight className={cn("h-6 w-6 transition-transform", isTeamSectionExpanded && "rotate-90")} />
                                <div>
                                    <h2 className="text-3xl font-bold tracking-tight font-headline">Team Engagements</h2>
                                    <p className="text-muted-foreground">
                                        Engagements you are supervising. Click to expand.
                                    </p>
                                </div>
                            </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-4 space-y-4">
                             {teamLoading ? (
                                <div className="flex h-48 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> Loading Team Engagements...</div>
                            ) : (
                                <>
                                <div className="flex justify-end">
                                    <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                                        <Button variant={teamView === 'grid' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTeamView('grid')}>
                                            <LayoutGrid className="mr-2 h-4 w-4"/>
                                            Board
                                        </Button>
                                         <Button variant={teamView === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTeamView('list')}>
                                            <List className="mr-2 h-4 w-4"/>
                                            List
                                        </Button>
                                    </div>
                                </div>
                                {teamView === 'grid' ? (
                                     <EngagementGrid engagements={teamEngagements} tasks={tasks} clients={clients} />
                                ) : (
                                    <TeamEngagementList 
                                        engagements={teamEngagements}
                                        tasks={tasks}
                                        clients={Array.from(clients.values())}
                                        engagementTypes={engagementTypes}
                                    />
                                )}
                                </>
                            )}
                        </CollapsibleContent>
                    </Collapsible>
                </>
            )}
        </div>
    )
}
