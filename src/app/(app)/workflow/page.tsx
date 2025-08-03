
"use client";

import * as React from "react";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Task, Client, Employee, Engagement } from "@/lib/data";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { Loader2 } from "lucide-react";

export default function WorkflowPage() {
    const { user } = useAuth();
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [engagements, setEngagements] = React.useState<Engagement[]>([]);
    const [clients, setClients] = React.useState<Client[]>([]);
    const [employees, setEmployees] = React.useState<Employee[]>([]);
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
             const currentUser = employeeSnapshot.docs[0].data() as Employee;
             
             // Fetch all master data once
            const [clientsSnapshot, employeesSnapshot] = await Promise.all([
                getDocs(collection(db, "clients")),
                getDocs(collection(db, "employees"))
            ]);
            setClients(clientsSnapshot.docs.map(doc => doc.data() as Client));
            setEmployees(employeesSnapshot.docs.map(doc => doc.data() as Employee));
             
             // Listen to engagements assigned to the current user
             const engagementsQuery = query(collection(db, "engagements"), where("assignedTo", "==", currentUser.id));
             const unsubEngagements = onSnapshot(engagementsQuery, (engagementsSnapshot) => {
                 const userEngagements = engagementsSnapshot.docs.map(doc => doc.data() as Engagement);
                 setEngagements(userEngagements);

                 if (userEngagements.length > 0) {
                     const engagementIds = userEngagements.map(e => e.id);
                     // Fetch tasks for those engagements
                     const tasksQuery = query(collection(db, "tasks"), where("engagementId", "in", engagementIds));
                     const unsubTasks = onSnapshot(tasksQuery, (tasksSnapshot) => {
                         setTasks(tasksSnapshot.docs.map(doc => doc.data() as Task));
                         setLoading(false);
                     });
                     return () => unsubTasks();
                 } else {
                     setTasks([]);
                     setLoading(false);
                 }
             });
             return () => unsubEngagements();
        }
        
        fetchInitialData();

    }, [user]);

    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> Loading Workflow...</div>;
    }

    return (
        <div className="flex h-full flex-col">
            <div className="mb-4">
                <h2 className="text-3xl font-bold tracking-tight font-headline">My Workflow</h2>
                <p className="text-muted-foreground">
                    Drag and drop your tasks to update their status.
                </p>
            </div>
            <div className="flex-grow">
                 <KanbanBoard tasks={tasks} clients={clients} employees={employees} engagements={engagements} />
            </div>
        </div>
    )
}
