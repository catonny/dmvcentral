
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs, orderBy } from "firebase/firestore";
import type { Client, Engagement, Employee, Department } from "@/lib/data";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { WorkspaceBoard } from "@/components/workspace/workspace-board";


export default function WorkspacePage() {
  const [allEngagements, setAllEngagements] = React.useState<Engagement[]>([]);
  const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [currentUserEmployee, setCurrentUserEmployee] = React.useState<Employee | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  
  React.useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchInitialData = async () => {
      try {
        const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
        const employeeSnapshot = await getDocs(employeeQuery);

        if (employeeSnapshot.empty) {
            setLoading(false);
            return;
        }
        
        const employeeProfile = { id: employeeSnapshot.docs[0].id, ...employeeSnapshot.docs[0].data() } as Employee;
        setCurrentUserEmployee(employeeProfile);

        const clientsUnsub = onSnapshot(collection(db, "clients"), (snapshot) => {
            setClients(new Map(snapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Client])));
        }, (error) => handleError(error, "clients"));

        const allEmployeesUnsub = onSnapshot(collection(db, "employees"), (snapshot) => {
          setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)))
        }, (error) => handleError(error, "employees"));
        
        const deptsUnsub = onSnapshot(query(collection(db, "departments"), orderBy("order")), (snapshot) => {
          setDepartments(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Department)))
        }, (error) => handleError(error, "departments"));

        const activeStatuses: Engagement['status'][] = ["Pending", "Awaiting Documents", "In Process", "Partner Review"];
        const engagementsQuery = query(collection(db, "engagements"), where("status", "in", activeStatuses));
        const engagementsUnsub = onSnapshot(engagementsQuery, (snapshot) => {
            const engagementsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
            setAllEngagements(engagementsData);
            setLoading(false);
        }, (error) => {
            handleError(error, "engagements");
            setLoading(false);
        });

        return () => {
            clientsUnsub();
            engagementsUnsub();
            allEmployeesUnsub();
            deptsUnsub();
        };

      } catch (error) {
        handleError(error as Error, "initial data");
        setLoading(false);
      }
    };
    
    const handleError = (error: Error, type: string) => {
      console.error(`Error fetching ${type}:`, error);
      toast({ title: "Error", description: `Could not fetch ${type}.`, variant: "destructive" });
    };

    fetchInitialData();
  }, [user, toast]);
  

  if (loading) {
    return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> Loading Workspace...</div>;
  }

  if (!currentUserEmployee) {
    return <div className="flex h-full w-full items-center justify-center">Could not load your user profile.</div>;
  }

  return (
    <div className="flex h-full flex-col">
       <div className="flex items-center justify-between mb-4">
            <div>
                <h2 className="text-3xl font-bold tracking-tight font-headline">Workspace</h2>
                <p className="text-muted-foreground">
                    Manage your firm's workload and collaborate with your team.
                </p>
            </div>
        </div>
        <WorkspaceBoard
            allEngagements={allEngagements}
            allEmployees={employees}
            allDepartments={departments}
            clientMap={clients}
            currentUser={currentUserEmployee}
        />
    </div>
  );
}
