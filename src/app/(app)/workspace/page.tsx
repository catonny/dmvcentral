
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs } from "firebase/firestore";
import type { Client, Engagement, Employee } from "@/lib/data";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { AssignmentList } from "@/components/workspace/assignment-list";
import { Loader2 } from "lucide-react";

export default function WorkspacePage() {
  const [engagements, setEngagements] = React.useState<Engagement[]>([]);
  const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
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

        const engagementsQuery = query(collection(db, "engagements"), where("assignedTo", "array-contains", employeeProfile.id));
        const engagementsUnsub = onSnapshot(engagementsQuery, (snapshot) => {
            const engagementsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
            setEngagements(engagementsData);
            setLoading(false);
        }, (error) => {
            handleError(error, "engagements");
            setLoading(false);
        });

        return () => {
            clientsUnsub();
            engagementsUnsub();
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

  return (
    <div className="flex flex-col h-full">
        <AssignmentList 
            engagements={engagements}
            clientMap={clients}
            currentUserEmployee={currentUserEmployee}
        />
    </div>
  );
}
