
"use client";

import * as React from 'react';
import { collection, onSnapshot } from "firebase/firestore";
import type { Client, Employee, Department } from "@/lib/data";
import { ClientManager } from "@/components/client/client-manager";
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function ClientsPage() {
    const [clients, setClients] = React.useState<Client[]>([]);
    const [employees, setEmployees] = React.useState<Employee[]>([]);
    const [departments, setDepartments] = React.useState<Department[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsubClients = onSnapshot(collection(db, 'clients'), 
            (snapshot) => setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client))),
            (err) => toast({ title: "Error", description: "Could not fetch clients.", variant: "destructive" })
        );

        const unsubEmployees = onSnapshot(collection(db, 'employees'),
            (snapshot) => setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee))),
            (err) => toast({ title: "Error", description: "Could not fetch employees.", variant: "destructive" })
        );

        const unsubDepartments = onSnapshot(collection(db, 'departments'),
            (snapshot) => {
                setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
                setLoading(false);
            },
            (err) => {
                toast({ title: "Error", description: "Could not fetch departments.", variant: "destructive" });
                setLoading(false);
            }
        );

        return () => {
            unsubClients();
            unsubEmployees();
            unsubDepartments();
        }

    }, [toast]);

    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return <ClientManager initialData={{ clients, employees, departments }} />;
}
