
"use client";

import * as React from "react";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import type { Client, Employee, Engagement, EngagementStatus } from "@/lib/data";
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
  const [currentUserEmployeeProfile, setCurrentUserEmployeeProfile] = React.useState<Employee | null>(null);
  const [loadingData, setLoadingData] = React.useState(true);
  
  const [widgets, setWidgets] = React.useState<Widget[]>([]);
  const [layout, setLayout] = React.useState<GridLayout.Layout[]>([]);
  
  const { toast } = useToast();

  React.useEffect(() => {
    if (!user) return;

    setLoadingData(true);
    const fetchProfileAndData = async () => {
        try {
            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const employeeSnapshot = await getDocs(employeeQuery);

            if (!employeeSnapshot.empty) {
                const profile = { id: employeeSnapshot.docs[0].id, ...employeeSnapshot.docs[0].data() } as Employee;
                setCurrentUserEmployeeProfile(profile);
            }

        } catch (error) {
            handleError(error as Error, 'employee profile');
        }

        const unsubClients = onSnapshot(query(collection(db, "clients")), (snapshot) => {
            setAllClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        }, (error) => handleError(error, "clients"));

        const activeStatuses: EngagementStatus[] = ["Pending", "Awaiting Documents", "In Process", "Partner Review"];
        const engagementsQuery = query(collection(db, "engagements"), where("status", "in", activeStatuses));
        const unsubEngagements = onSnapshot(engagementsQuery, (snapshot) => {
            setEngagements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement)));
        }, (error) => handleError(error, "engagements"));

        const unsubEmployees = onSnapshot(query(collection(db, "employees")), (snapshot) => {
            setAllEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
        }, (error) => handleError(error, "employees"));
        
        setLoadingData(false);

        return () => {
            unsubClients();
            unsubEngagements();
            unsubEmployees();
        };
    };

    const handleError = (error: Error, type: string) => {
        console.error(`Error fetching real-time ${type}:`, error);
        toast({ title: "Real-time Update Error", description: `Could not sync ${type}.`, variant: "destructive" });
    }

    fetchProfileAndData();
  }, [user, toast]);
  
  const { isPartner, visibleClients, dashboardEngagements } = React.useMemo(() => {
    if (!currentUserEmployeeProfile) {
        return { isPartner: false, visibleClients: [], dashboardEngagements: [] };
    }

    const userIsPartner = currentUserEmployeeProfile.role.includes("Partner");

    if (userIsPartner) {
      const partnerClients = allClients.filter(c => c.partnerId === currentUserEmployeeProfile.id);
      const partnerClientIds = partnerClients.map(c => c.id);
      
      const relevantEngagements = engagements.filter(e => 
        (e.assignedTo === null || e.assignedTo.length === 0) || 
        partnerClientIds.includes(e.clientId) 
      );

      return { 
        isPartner: true, 
        visibleClients: allClients,
        dashboardEngagements: relevantEngagements 
      };
    } else {
      const assignedEngagements = engagements.filter(e => e.assignedTo.includes(currentUserEmployeeProfile.id));
      const assignedClientIds = new Set(assignedEngagements.map(e => e.clientId));
      const assignedClients = allClients.filter(client => assignedClientIds.has(client.id));
      
      return {
          isPartner: false,
          visibleClients: assignedClients,
          dashboardEngagements: assignedEngagements
      };
    }
  }, [currentUserEmployeeProfile, allClients, engagements]);
  
  React.useEffect(() => {
    const defaultWidgets: Widget[] = [
        { id: 'status-cards', title: 'Status Cards', description: 'Overall status of clients and engagements.', component: StatusCards, condition: true, defaultLayout: { x: 0, y: 0, w: 12, h: 4 } },
        { id: 'workload-distribution', title: 'Workload Distribution', description: 'Pending and unassigned engagements across the team.', component: WorkloadDistribution, condition: isPartner, defaultLayout: { x: 0, y: 4, w: 6, h: 12 } },
        { id: 'todo-section', title: 'To-Do List', description: 'Action items that require your attention.', component: TodoSection, condition: true, defaultLayout: { x: 6, y: 4, w: 6, h: 12 } },
    ];
    
    const visibleWidgets = defaultWidgets.filter(w => w.condition);
    setWidgets(visibleWidgets);

    const storedLayout = localStorage.getItem('dashboardLayout');
    if (storedLayout) {
        try {
          const parsedLayout = JSON.parse(storedLayout);
          // Basic validation to ensure layout is not malformed
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
  }, [isPartner]);
  
  const handleLayoutChange = (newLayout: GridLayout.Layout[]) => {
    setLayout(newLayout);
    localStorage.setItem('dashboardLayout', JSON.stringify(newLayout));
  };

  if (loadingData) {
    return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  const getWidgetProps = (id: string) => {
      switch (id) {
          case 'status-cards':
              return { clients: visibleClients, engagements: dashboardEngagements, isPartner };
          case 'workload-distribution':
              return { engagements: engagements, employees: allEmployees };
          case 'todo-section':
              return { currentUser: currentUserEmployeeProfile };
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
             <Badge variant={isPartner ? "secondary" : "outline"}>
                {isPartner ? "Partner View" : "Personal View"}
            </Badge>
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
