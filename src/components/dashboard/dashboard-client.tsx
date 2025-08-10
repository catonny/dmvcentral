

"use client";

import * as React from "react";
import type { Client, Employee, Engagement, EngagementStatus, Task } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { StatusCards } from "@/components/dashboard/status-cards";
import { TodoSection } from "@/components/dashboard/todo-section";
import { GripVertical, Grip, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface DashboardClientProps {
    serverData: {
        clients: Client[];
        employees: Employee[];
        engagements: Engagement[];
        tasks: Task[];
        currentUser: Employee | null;
    } | null;
    error?: string;
}


export function DashboardClient({ serverData, error }: DashboardClientProps) {
  const { user } = useAuth();
  const [widgets, setWidgets] = React.useState<Widget[]>([]);
  const [layout, setLayout] = React.useState<GridLayout.Layout[]>([]);
  
  const { toast } = useToast();

  React.useEffect(() => {
    if(error) {
        toast({
            title: "Dashboard Error",
            description: error,
            variant: "destructive"
        })
    }
  }, [error, toast]);
  
  const { isPartner, isAdmin, userRole, dashboardData } = React.useMemo(() => {
    if (!serverData || !serverData.currentUser || !user) {
        return { isPartner: false, isAdmin: false, userRole: "Employee", dashboardData: null };
    }
    
    const { clients, engagements, tasks, employees, currentUser } = serverData;

    let userIsAdmin = currentUser.role.includes("Admin");
    let userIsPartner = currentUser.role.includes("Partner");
    let roleForView: "Admin" | "Partner" | "Employee" = "Employee";

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
                clients: clients,
                engagements: engagements,
                tasks: tasks,
                currentUser: currentUser,
            }
        };
    }
    
    if (userIsPartner) {
        roleForView = "Partner";
        const partnerClients = clients.filter(c => c.partnerId === currentUser.id);
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
                currentUser: currentUser,
            }
        };
    }
    
    const employeeEngagements = engagements.filter(e => e.assignedTo.includes(currentUser.id));
    const employeeClientIds = new Set(employeeEngagements.map(e => e.clientId));
    const employeeClients = clients.filter(c => employeeClientIds.has(c.id));
    const employeeTasks = tasks.filter(t => t.assignedTo === currentUser.id);
    
    return {
        isPartner: false,
        isAdmin: false,
        userRole: roleForView,
        dashboardData: {
            clients: employeeClients,
            engagements: employeeEngagements,
            tasks: employeeTasks,
            currentUser: currentUser,
        }
    };

  }, [serverData, user]);
  
  React.useEffect(() => {
    const defaultWidgets: Widget[] = [
        { id: 'status-cards', title: 'Status Cards', description: 'Overall status of clients and engagements.', component: StatusCards, condition: true, defaultLayout: { x: 0, y: 0, w: 12, h: 4 } },
        { id: 'todo-section', title: 'To-Do List', description: 'Action items that require your attention.', component: TodoSection, condition: true, defaultLayout: { x: 0, y: 4, w: 12, h: 12 } },
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
  
  const getWidgetProps = (id: string) => {
      switch (id) {
          case 'status-cards':
              return { data: dashboardData, userRole };
          case 'todo-section':
              return { currentUser: serverData?.currentUser, allClients: serverData?.clients, allEmployees: serverData?.employees };
          default:
              return {};
      }
  };
  
  if (!serverData) {
     return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2">
                    <AlertCircle /> Dashboard Error
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p>Could not load dashboard data from the server.</p>
                <p className="text-sm text-muted-foreground mt-2">{error || "An unknown error occurred."}</p>
            </CardContent>
        </Card>
     )
  }

  return (
    <>
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
