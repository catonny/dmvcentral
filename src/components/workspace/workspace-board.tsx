
"use client";

import * as React from "react";
import { collection, query, where, onSnapshot, getDocs, orderBy, writeBatch, doc } from "firebase/firestore";
import type { Client, Engagement, Employee, Department, Task, EngagementType } from "@/lib/data";
import { db, logActivity } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, PlusCircle } from "lucide-react";
import { WorkspaceBoard } from "@/components/workspace/workspace-board";
import { Button } from "@/components/ui/button";
import { AddTaskDialog } from "@/components/workspace/add-task-dialog";


export default function WorkspacePage() {
  const [allEngagements, setAllEngagements] = React.useState<Engagement[]>([]);
  const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
  const [allClients, setAllClients] = React.useState<Client[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [currentUserEmployee, setCurrentUserEmployee] = React.useState<Employee | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
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
            setAllClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        }, (error) => handleError(error, "clients"));

        const allEmployeesUnsub = onSnapshot(collection(db, "employees"), (snapshot) => {
          setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)))
        }, (error) => handleError(error, "employees"));
        
        const deptsUnsub = onSnapshot(query(collection(db, "departments"), orderBy("order")), (snapshot) => {
          setDepartments(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Department)))
        }, (error) => handleError(error, "departments"));

        const engagementTypesUnsub = onSnapshot(collection(db, "engagementTypes"), (snapshot) => {
          setEngagementTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EngagementType)));
        }, (error) => handleError(error, "engagement types"));

        const activeStatuses: Engagement['status'][] = ["Pending", "Awaiting Documents", "In Process", "Partner Review", "On Hold"];
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
            engagementTypesUnsub();
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
  
  const handleAddTask = async (data: any, client?: Client, reporterId?: string, engagementId?: string) => {
        if (!currentUserEmployee) {
             toast({ title: "Error", description: "Could not identify current user.", variant: "destructive" });
             return;
        }
        try {
            const batch = writeBatch(db);
            let engagementTypeId = data.type;
            const engagementTypeIsExisting = engagementTypes.some(et => et.id === engagementTypeId);
            const engagementDocRef = engagementId ? doc(db, 'engagements', engagementId) : doc(collection(db, 'engagements'));

            // Handle new template creation
            if (data.saveAsTemplate && data.templateName && !engagementTypeIsExisting) {
                const newTypeRef = doc(collection(db, 'engagementTypes'));
                engagementTypeId = newTypeRef.id;
                const newEngagementType: EngagementType = {
                    id: newTypeRef.id,
                    name: data.templateName,
                    description: data.remarks.substring(0, 100),
                    subTaskTitles: ["Task 1", "Task 2", "Task 3"]
                };
                batch.set(newTypeRef, newEngagementType);
                toast({ title: "Template Created", description: `New workflow template "${data.templateName}" was created.` });
            }

            const newEngagementData: Engagement = {
                id: engagementDocRef.id,
                remarks: data.remarks,
                clientId: data.clientId,
                type: engagementTypeId,
                assignedTo: data.assignedTo,
                reportedTo: reporterId || "", 
                status: 'Pending',
                dueDate: data.dueDate.toISOString()
            };
            batch.set(engagementDocRef, newEngagementData);
            
            await logActivity({
                engagement: newEngagementData,
                type: 'CREATE_ENGAGEMENT',
                user: currentUserEmployee,
                details: {}
            });
            
            const engagementType = engagementTypes.find(et => et.id === engagementTypeId);
            const subTaskTitles = engagementType?.subTaskTitles || (data.saveAsTemplate ? ["Task 1", "Task 2", "Task 3"] : []);
            
            subTaskTitles.forEach((title, index) => {
                const taskDocRef = doc(collection(db, 'tasks'));
                const newTask: Task = {
                    id: taskDocRef.id,
                    engagementId: engagementDocRef.id,
                    title,
                    status: 'Pending',
                    order: index + 1,
                    assignedTo: data.assignedTo[0] || currentUserEmployee.id,
                };
                batch.set(taskDocRef, newTask);
            });

            await batch.commit();
            
            toast({ title: "Engagement Added", description: `New engagement and its tasks have been created.` });
            setIsDialogOpen(false);
        } catch (error) {
            console.error("Error adding engagement:", error);
            toast({ title: "Error", description: "Failed to add the new engagement.", variant: "destructive" });
        }
    };


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
             <Button onClick={() => setIsDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Engagement
            </Button>
        </div>
        <WorkspaceBoard
            allEngagements={allEngagements}
            allEmployees={employees}
            allDepartments={departments}
            engagementTypes={engagementTypes}
            clientMap={clients}
            currentUser={currentUserEmployee}
        />
        <AddTaskDialog 
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            onSave={handleAddTask}
            clients={allClients}
            engagementTypes={engagementTypes}
            allEmployees={employees}
            departments={departments}
            currentUserEmployee={currentUserEmployee}
        />
    </div>
  );
}
