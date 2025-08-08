
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Engagement, Employee, Client, EngagementType, EngagementStatus, Task } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AdvancedReportFilters } from "@/components/reports/advanced/advanced-report-filters";
import { AdvancedReportDataTable } from "@/components/reports/advanced/advanced-report-data-table";

export interface FilterState {
  engagementTypeId: string;
  engagementStatus: EngagementStatus | "All";
  taskFilters: {
    taskTitle: string;
    status: "Pending" | "Completed" | "Any";
  }[];
}

export default function AdvancedEngagementReportPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    
    // Master Data
    const [allEngagements, setAllEngagements] = React.useState<Engagement[]>([]);
    const [allTasks, setAllTasks] = React.useState<Task[]>([]);
    const [allClients, setAllClients] = React.useState<Client[]>([]);
    const [allEngagementTypes, setAllEngagementTypes] = React.useState<EngagementType[]>([]);
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);

    const [filters, setFilters] = React.useState<FilterState | null>(null);

    React.useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const checkUserRole = async () => {
            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const employeeSnapshot = await getDocs(employeeQuery);
            if (!employeeSnapshot.empty) {
                const employeeData = employeeSnapshot.docs[0].data() as Employee;
                if (employeeData.role.includes("Partner")) {
                    setHasAccess(true);
                }
            }
        };
        checkUserRole();
        
        const unsubEngagements = onSnapshot(collection(db, "engagements"), 
            (snapshot) => setAllEngagements(snapshot.docs.map(doc => doc.data() as Engagement)),
            (err) => toast({title: "Error", description: "Could not fetch engagements."})
        );
        const unsubTasks = onSnapshot(collection(db, "tasks"), 
            (snapshot) => setAllTasks(snapshot.docs.map(doc => doc.data() as Task)),
            (err) => toast({title: "Error", description: "Could not fetch tasks."})
        );
         const unsubClients = onSnapshot(collection(db, "clients"), 
            (snapshot) => setAllClients(snapshot.docs.map(doc => doc.data() as Client)),
            (err) => toast({title: "Error", description: "Could not fetch clients."})
        );
         const unsubEngagementTypes = onSnapshot(collection(db, "engagementTypes"), 
            (snapshot) => setAllEngagementTypes(snapshot.docs.map(doc => doc.data() as EngagementType)),
            (err) => toast({title: "Error", description: "Could not fetch engagement types."})
        );
         const unsubEmployees = onSnapshot(collection(db, "employees"), 
            (snapshot) => setAllEmployees(snapshot.docs.map(doc => doc.data() as Employee)),
            (err) => toast({title: "Error", description: "Could not fetch employees."})
        );
        
        setLoading(false);

        return () => {
            unsubEngagements();
            unsubTasks();
            unsubClients();
            unsubEngagementTypes();
            unsubEmployees();
        }

    }, [user, toast]);

    const filteredEngagements = React.useMemo(() => {
        if (!filters || !filters.engagementTypeId) {
            return [];
        }

        let engagements = allEngagements.filter(e => e.type === filters.engagementTypeId);

        if (filters.engagementStatus !== "All") {
            engagements = engagements.filter(e => e.status === filters.engagementStatus);
        }

        if (filters.taskFilters.some(f => f.status !== "Any")) {
            const taskMap = new Map<string, Task[]>();
            allTasks.forEach(task => {
                if (!taskMap.has(task.engagementId)) {
                    taskMap.set(task.engagementId, []);
                }
                taskMap.get(task.engagementId)!.push(task);
            });

            engagements = engagements.filter(eng => {
                const engTasks = taskMap.get(eng.id) || [];
                return filters.taskFilters.every(filter => {
                    if (filter.status === "Any") return true;
                    const task = engTasks.find(t => t.title === filter.taskTitle);
                    if (!task) return false;
                    return task.status === filter.status;
                });
            });
        }
        
        return engagements;

    }, [filters, allEngagements, allTasks]);


    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!hasAccess) {
         return (
            <Card>
                <CardHeader>
                    <CardTitle>Access Denied</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>You do not have the required permissions to view this page. This view is for Partners only.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
             <Button variant="outline" size="sm" onClick={() => router.push('/reports')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Reports
            </Button>
            
            <AdvancedReportFilters
                engagementTypes={allEngagementTypes}
                onFiltersChange={setFilters}
            />

            <AdvancedReportDataTable
                engagements={filteredEngagements}
                clients={allClients}
                employees={allEmployees}
                tasks={allTasks}
            />
        </div>
    )
}
