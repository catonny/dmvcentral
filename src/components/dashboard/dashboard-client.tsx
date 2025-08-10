
"use client";

import * as React from "react";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Client, Employee, Engagement, EngagementStatus, Task, CalendarEvent } from "@/lib/data";
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
    clients: Client[];
    employees: Employee[];
    engagements: Engagement[];
    tasks: Task[];
}

export function DashboardClient({ clients, employees, engagements, tasks }: DashboardClientProps) {
  const { user, loading: authLoading } = useAuth();
  const [currentUser, setCurrentUser] = React.useState<Employee | null>(null);
  
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  
  const [widgets, setWidgets] = React.useState<Widget[]>([]);
  const [layout, setLayout] = React.useState<GridLayout.Layout[]>([]);
  
  const { toast } = useToast();
  
  React.useEffect(() => {
    if (user) {
        const userInDb = employees.find(e => e.email === user.email);
        if (userInDb) {
            setCurrentUser(userInDb);
        }
    }
  }, [user, employees]);

  React.useEffect(() => {
    const unsubEvents = onSnapshot(collection(db, "events"), (snap) => setEvents(snap.docs.map(doc => doc.data() as CalendarEvent)));
    return () => unsubEvents();
  }, []);

  
  const { isPartner, isAdmin, userRole, dashboardData } = React.useMemo(() => {
    if (!currentUser || !user) {
        return { isPartner: false, isAdmin: false, userRole: "Employee", dashboardData: null };
    }
    
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
            dashboardData: { clients, engagements, tasks, events, currentUser }
        };
    }
    
    if (userIsPartner) {
        roleForView = "Partner";
        const partnerClients = clients.filter(c => c.partnerId === currentUser.id);
        const partnerClientIds = new Set(partnerClients.map(c => c.id));
        const partnerEngagements = engagements.filter(e => partnerClientIds.has(e.clientId));
        const partnerEngagementIds = new Set(partnerEngagements.map(e => e.id));
        const partnerTasks = tasks.filter(t => t.engagementId && partnerEngagementIds.has(t.engagementId));
        const partnerEvents = events.filter(e => e.attendees?.some(attendeeId => partnerClientIds.has(attendeeId)));


        return {
            isPartner: true,
            isAdmin: false,
            userRole: roleForView,
            dashboardData: { clients: partnerClients, engagements: partnerEngagements, tasks: partnerTasks, events: partnerEvents, currentUser }
        };
    }
    
    const employeeEngagements = engagements.filter(e => e.assignedTo.includes(currentUser.id));
    const employeeClientIds = new Set(employeeEngagements.map(e => e.clientId));
    const employeeClients = clients.filter(c => employeeClientIds.has(c.id));
    const employeeEngagementIds = new Set(employeeEngagements.map(e => e.id));
    const employeeTasks = tasks.filter(t => t.engagementId && employeeEngagementIds.has(t.engagementId));
    const employeeEvents = events.filter(e => e.attendees?.includes(currentUser.id));
    
    return {
        isPartner: false,
        isAdmin: false,
        userRole: roleForView,
        dashboardData: { clients: employeeClients, engagements: employeeEngagements, tasks: employeeTasks, events: employeeEvents, currentUser }
    };

  }, [user, currentUser, clients, engagements, tasks, events]);
  
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
            // Filter out layout items that don't have a corresponding widget
            const filteredLayout = parsedLayout.filter(l => visibleWidgets.some(w => w.id === l.i));
            setLayout(filteredLayout);
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
              return { currentUser: currentUser, allClients: clients, allEmployees: employees };
          default:
              return {};
      }
  };

  if (authLoading) {
     return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!dashboardData) {
      return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
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
