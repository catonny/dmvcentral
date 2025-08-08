
"use client";

import * as React from "react";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import type { Client, Employee, Engagement, EngagementStatus, Task } from "@/lib/data";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { StatusCards } from "@/components/dashboard/status-cards";
import { TodoSection } from "@/components/dashboard/todo-section";
import { Badge } from "@/components/ui/badge";
import { WorkloadDistribution } from "@/components/dashboard/workload-distribution";
import { GripVertical, Grip } from "lucide-react";
import { Card } from "@/components/ui/card";
import GridLayout from "react-grid-layout";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface Widget {
  id: string;
  title: string;
  description: string;
  component: React.FC<any>;
  condition: boolean;
  defaultLayout: { x: number; y: number; w: number; h: number; };
}

export function DashboardClient() {
  const { user } = useAuth();
  const [allClients, setAllClients] = React.useState<Client[]>([]);
  const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
  const [engagements, setEngagements] = React.useState<Engagement[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [currentUserEmployeeProfile, setCurrentUserEmployeeProfile] = React.useState<Employee | null>(null);
  const [loading, setLoading] = React.useState(true);
  
  const [widgets, setWidgets] = React.useState<Widget[]>([]);
  const [layout, setLayout] = React.useState<GridLayout.Layout[]>([]);
  
  const { toast } = useToast();

  React.useEffect(() => {
    if (!user) return;

    setLoading(true);

    let profileFetched = false;
    let clientsFetched = false;
    let engagementsFetched = false;
    let employeesFetched = false;
    let tasksFetched = false;

    const checkAllDataFetched = () => {
        if (profileFetched && clientsFetched && engagementsFetched && employeesFetched && tasksFetched) {
            setLoading(false);
        }
    }

    const handleError = (error: Error, type: string) => {
        console.error(`Error fetching real-time ${type}:`, error);
        toast({ title: "Real-time Update Error", description: `Could not sync ${type}.`, variant: "destructive" });
    }

    const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
    const unsubProfile = onSnapshot(employeeQuery, (snapshot) => {
        if (!snapshot.empty) {
            const profile = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Employee;
            setCurrentUserEmployeeProfile(profile);
        }
        profileFetched = true;
        checkAllDataFetched();
    }, (error) => handleError(error, 'employee profile'));


    const unsubClients = onSnapshot(query(collection(db, "clients")), (snapshot) => {
        setAllClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        clientsFetched = true;
        checkAllDataFetched();
    }, (error) => handleError(error, "clients"));

    const activeStatuses: EngagementStatus[] = ["Pending", "Awaiting Documents", "In Process", "Partner Review", "On Hold"];
    const engagementsQuery = query(collection(db, "engagements"), where("status", "in", activeStatuses));
    const unsubEngagements = onSnapshot(engagementsQuery, (snapshot) => {
        setEngagements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement)));
        engagementsFetched = true;
        checkAllDataFetched();
    }, (error) => handleError(error, "engagements"));

    const unsubEmployees = onSnapshot(query(collection(db, "employees")), (snapshot) => {
        setAllEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
        employeesFetched = true;
        checkAllDataFetched();
    }, (error) => handleError(error, "employees"));
    
    const unsubTasks = onSnapshot(query(collection(db, "tasks")), (snapshot) => {
        setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
        tasksFetched = true;
        checkAllDataFetched();
    }, (error) => {
        handleError(error, "tasks");
    });
    
    return () => {
        unsubProfile();
        unsubClients();
        unsubEngagements();
        unsubEmployees();
        unsubTasks();
    };
  }, [user, toast]);
  
  const { isPartner, isAdmin, userRole, dashboardData } = React.useMemo(() => {
    if (!currentUserEmployeeProfile || !user) {
        return { isPartner: false, isAdmin: false, userRole: "Employee", dashboardData: null };
    }

    let userIsAdmin = currentUserEmployeeProfile.role.includes("Admin");
    let userIsPartner = currentUserEmployeeProfile.role.includes("Partner");
    let roleForView: "Admin" | "Partner" | "Employee" = "Employee";

    // Special logic for the main developer user
    if (user.email === 'ca.tonnyvarghese@gmail.com') {
        const sessionRole = sessionStorage.getItem('userRole');
        if (sessionRole === 'developer') {
            userIsAdmin = true;
            userIsPartner = true; 
        } else {
            userIsAdmin = false;
            userIsPartner = true;
        }
    }
    
    if (userIsAdmin) {
        roleForView = "Admin";
        return {
            isPartner: userIsPartner,
            isAdmin: true,
            userRole: roleForView,
            dashboardData: {
                clients: allClients,
                engagements: engagements,
                tasks: tasks,
                currentUser: currentUserEmployeeProfile,
            }
        };
    }
    
    if (userIsPartner) {
        roleForView = "Partner";
        const partnerClients = allClients.filter(c => c.partnerId === currentUserEmployeeProfile.id);
        const partnerClientIds = new Set(partnerClients.map(c => c.id));
        const partnerEngagements = engagements.filter(e => partnerClientIds.has(e.clientId));
        const partnerEngagementIds = new Set(partnerEngagements.map(e => e.id));
        const partnerTasks = tasks.filter(t => partnerEngagementIds.has(t.engagementId));

        return {
            isPartner: true,
            isAdmin: false,
            userRole: roleForView,
            dashboardData: {
                clients: partnerClients,
                engagements: partnerEngagements,
                tasks: partnerTasks,
                currentUser: currentUserEmployeeProfile,
            }
        };
    }
    
    // Default Employee view
    const employeeEngagements = engagements.filter(e => e.assignedTo.includes(currentUserEmployeeProfile.id));
    const employeeClientIds = new Set(employeeEngagements.map(e => e.clientId));
    const employeeClients = allClients.filter(c => employeeClientIds.has(c.id));
    const employeeTasks = tasks.filter(t => t.assignedTo === currentUserEmployeeProfile.id);
    
    return {
        isPartner: false,
        isAdmin: false,
        userRole: roleForView,
        dashboardData: {
            clients: employeeClients,
            engagements: employeeEngagements,
            tasks: employeeTasks,
            currentUser: currentUserEmployeeProfile,
        }
    };

  }, [currentUserEmployeeProfile, allClients, engagements, tasks, user]);
  
  React.useEffect(() => {
    const defaultWidgets: Widget[] = [
        { id: 'status-cards', title: 'Status Cards', description: 'Overall status of clients and engagements.', component: StatusCards, condition: true, defaultLayout: { x: 0, y: 0, w: 12, h: 4 } },
        { id: 'workload-distribution', title: 'Workload Distribution', description: 'Pending and unassigned engagements across the team.', component: WorkloadDistribution, condition: isAdmin || isPartner, defaultLayout: { x: 0, y: 4, w: 6, h: 12 } },
        { id: 'todo-section', title: 'To-Do List', description: 'Action items that require your attention.', component: TodoSection, condition: true, defaultLayout: { x: 6, y: 4, w: 6, h: 12 } },
    ];
    
    const visibleWidgets = defaultWidgets.filter(w => w.condition);
    setWidgets(visibleWidgets);

    const storedLayout = localStorage.getItem('dashboardLayout');
    if (storedLayout) {
        try {
          const parsedLayout = JSON.parse(storedLayout);
          if (Array.isArray(parsedLayout)) {
            setLayout(parsedLayout);
          } else {
            setLayout(visibleWidgets.map(w => ({...w.defaultLayout, i: w.id})));
          }
        } catch(e) {
            setLayout(visibleWidgets.map(w => ({...w.defaultLayout, i: w.id})));
        }
    } else {
        setLayout(visibleWidgets.map(w => ({...w.defaultLayout, i: w.id})));
    }
  }, [isAdmin, isPartner]);
  
  const handleLayoutChange = (newLayout: GridLayout.Layout[]) => {
    setLayout(newLayout);
    localStorage.setItem('dashboardLayout', JSON.stringify(newLayout));
  };

  if (loading) {
    return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  const getWidgetProps = (id: string) => {
      switch (id) {
          case 'status-cards':
              return { data: dashboardData, userRole };
          case 'workload-distribution':
              return { engagements: engagements, employees: allEmployees };
          case 'todo-section':
              return { currentUser: currentUserEmployeeProfile, allClients, allEmployees };
          default:
              return {};
      }
  };

  return (
    <>
      <div className="flex items-center justify-between space-y-2 mb-4">
        <div>
           <div className="flex items-center gap-4">
             <h2 className="text-3xl font-bold tracking-tight font-headline">Dashboard</h2>
             {isAdmin && (
                <Badge variant="destructive">
                    {userRole} View
                </Badge>
             )}
           </div>
          <p className="text-muted-foreground">
            A command center for your firm's engagements and clients.
          </p>
        </div>
      </div>

       <GridLayout
            className="layout"
            layout={layout}
            cols={12}
            rowHeight={30}
            width={1200}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".widget-drag-handle"
        >
          {widgets.map(widget => {
              const currentLayout = layout.find(l => l.i === widget.id) || widget.defaultLayout;
              return (
                <div key={widget.id} data-grid={currentLayout}>
                    <Card className="h-full w-full overflow-hidden flex flex-col">
                         <div className="absolute top-2 right-2 z-10 cursor-grab p-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity widget-drag-handle">
                            <GripVertical className="h-5 w-5" />
                        </div>
                        <div className="p-4 flex-grow">
                            <widget.component {...getWidgetProps(widget.id)} />
                        </div>
                        <div className="react-resizable-handle absolute bottom-0 right-0 cursor-se-resize w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Grip className="w-full h-full text-muted-foreground" />
                        </div>
                    </Card>
                </div>
              )
          })}
      </GridLayout>
    </>
  );
}
