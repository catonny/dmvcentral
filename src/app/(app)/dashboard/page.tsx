
"use client";

import * as React from 'react';
import type { Client, Employee, Engagement, Task } from "@/lib/data";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
    const [clients, setClients] = React.useState<Client[]>([]);
    const [employees, setEmployees] = React.useState<Employee[]>([]);
    const [engagements, setEngagements] = React.useState<Engagement[]>([]);
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubClients = onSnapshot(collection(db, "clients"), (snap) => setClients(snap.docs.map(doc => doc.data() as Client)),
            (err) => toast({ title: "Error", description: "Could not fetch clients.", variant: "destructive" }));
        
        const unsubEmployees = onSnapshot(collection(db, "employees"), (snap) => setEmployees(snap.docs.map(doc => doc.data() as Employee)),
            (err) => toast({ title: "Error", description: "Could not fetch employees.", variant: "destructive" }));

        const unsubEngagements = onSnapshot(collection(db, "engagements"), (snap) => setEngagements(snap.docs.map(doc => doc.data() as Engagement)),
            (err) => toast({ title: "Error", description: "Could not fetch engagements.", variant: "destructive" }));
            
        const unsubTasks = onSnapshot(collection(db, "tasks"), (snap) => {
            setTasks(snap.docs.map(doc => doc.data() as Task));
            setLoading(false);
        }, (err) => {
            toast({ title: "Error", description: "Could not fetch tasks.", variant: "destructive" });
            setLoading(false);
        });

        return () => {
            unsubClients();
            unsubEmployees();
            unsubEngagements();
            unsubTasks();
        };
    }, [toast]);

    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return <DashboardClient initialData={{ clients, employees, engagements, tasks }} />;
}
