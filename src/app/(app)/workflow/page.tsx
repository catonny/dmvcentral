
"use client";

import * as React from "react";
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Task, Client, Employee, Engagement, TaskStatus } from "@/lib/data";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskTableView } from "@/components/workflow/task-table-view";

export default function WorkflowPage() {
    const { user } = useAuth();
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [engagements, setEngagements] = React.useState<Engagement[]>([]);
    const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
    const [employees, setEmployees] = React.useState<Map<string, Employee>>(new Map());
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
             
             // Fetch all master data once
            const [clientsSnapshot, employeesSnapshot] = await Promise.all([
                getDocs(collection(db, "clients")),
                getDocs(collection(db, "employees"))
            ]);
            setClients(new Map(clientsSnapshot.docs.map(doc => [doc.id, doc.data() as Client])));
            setEmployees(new Map(employeesSnapshot.docs.map(doc => [doc.id, doc.data() as Employee])));
             
             // Listen to engagements assigned to the current user
             const engagementsQuery = query(collection(db, "engagements"), where("assignedTo", "array-contains", currentUser.id));
             const unsubEngagements = onSnapshot(engagementsQuery, (engagementsSnapshot) => {
                 const userEngagements = engagementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
                 setEngagements(userEngagements);

                 if (userEngagements.length > 0) {
                     // Fetch tasks for those engagements, now filtering by task assignee
                     const tasksQuery = query(collection(db, "tasks"), where("assignedTo", "==", currentUser.id));
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
             return () => unsubEngagements();
        }
        
        fetchInitialData();

    }, [user]);

    const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
        const taskRef = doc(db, "tasks", taskId);
        try {
            await updateDoc(taskRef, { status: newStatus });
            setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? {...t, status: newStatus} : t));
        } catch (error) {
             console.error(`Error updating task status:`, error);
        }
    };

    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> Loading Workflow...</div>;
    }

    return (
        <div className="flex h-full flex-col">
            <Tabs defaultValue="table" className="flex-grow flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight font-headline">My Workflow</h2>
                        <p className="text-muted-foreground">
                            A view of all tasks assigned to you.
                        </p>
                    </div>
                    <TabsList>
                        <TabsTrigger value="table">Table View</TabsTrigger>
                        <TabsTrigger value="kanban">Kanban View</TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="table" className="flex-grow">
                     <TaskTableView 
                        tasks={tasks}
                        engagements={engagements}
                        clients={clients}
                        onTaskStatusChange={handleTaskStatusChange}
                     />
                </TabsContent>
                 <TabsContent value="kanban" className="flex-grow">
                     <KanbanBoard 
                        tasks={tasks} 
                        clients={Array.from(clients.values())} 
                        employees={Array.from(employees.values())}
                        engagements={engagements}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}
