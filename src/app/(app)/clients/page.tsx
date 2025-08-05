
"use client";

import * as React from "react";
import { collection, query, onSnapshot, getDocs, where } from "firebase/firestore";
import type { Client, Employee } from "@/lib/data";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { ClientManager } from "@/components/client/client-manager";
import { useAuth } from "@/hooks/use-auth";
import { GripVertical, Grip } from "lucide-react";
import { Card } from "@/components/ui/card";
import GridLayout from "react-grid-layout";

interface Widget {
  id: string;
  title: string;
  description: string;
  component: React.FC<any>;
  defaultLayout: { x: number; y: number; w: number; h: number; };
}


export default function ClientsPage() {
  const [allClients, setAllClients] = React.useState<Client[]>([]);
  const [currentUserEmployeeProfile, setCurrentUserEmployeeProfile] = React.useState<Employee | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [widgets, setWidgets] = React.useState<Widget[]>([]);
  const [layout, setLayout] = React.useState<GridLayout.Layout[]>([]);

  const { toast } = useToast();
  const { user } = useAuth();
  
  React.useEffect(() => {
    if (!user) return;

    let clientsUnsubscriber: ReturnType<typeof onSnapshot> | undefined;

    const fetchData = async () => {
      setLoading(true);
      try {
        const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
        const employeeSnapshot = await getDocs(employeeQuery);
        
        if (!employeeSnapshot.empty) {
          const userEmployeeProfile = { id: employeeSnapshot.docs[0].id, ...employeeSnapshot.docs[0].data() } as Employee;
          setCurrentUserEmployeeProfile(userEmployeeProfile);

          const clientsQuery = query(collection(db, "clients"));
          clientsUnsubscriber = onSnapshot(clientsQuery, (snapshot) => {
            const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            setAllClients(clientsData);
            setLoading(false);
          }, (error) => handleError(error, "clients"));
        } else {
            toast({ title: "Warning", description: "No employee profile found for your user email.", variant: "destructive" });
            setLoading(false);
        }
      } catch (error) {
        handleError(error as Error, "initial data");
        setLoading(false);
      }
    };

    const handleError = (error: Error, type: string) => {
      console.error(`Error fetching ${type}:`, error);
      toast({ title: "Error", description: `Failed to fetch ${type}.`, variant: "destructive" });
    };

    fetchData();

    return () => {
      clientsUnsubscriber?.();
    };
  }, [toast, user]);
  
  React.useEffect(() => {
      const defaultWidgets: Widget[] = [
        {
            id: "client-manager",
            title: "Client Management",
            description: "View, add, and manage all your firm's clients.",
            component: ClientManager,
            defaultLayout: { x: 0, y: 0, w: 12, h: 20 }
        },
    ];

    setWidgets(defaultWidgets);

    const storedLayout = localStorage.getItem("clientPageLayout");
    if (storedLayout) {
        setLayout(JSON.parse(storedLayout));
    } else {
        setLayout(defaultWidgets.map(w => ({...w.defaultLayout, i: w.id})));
    }
  }, []);

  const { isPartner, visibleClients } = React.useMemo(() => {
    if (!currentUserEmployeeProfile) {
      return { isPartner: false, visibleClients: [] };
    }

    const userIsPartner = currentUserEmployeeProfile.role.includes("Partner");
    return {
      isPartner: userIsPartner,
      visibleClients: allClients,
    };
  }, [currentUserEmployeeProfile, allClients]);
  
   const handleLayoutChange = (newLayout: GridLayout.Layout[]) => {
    setLayout(newLayout);
    localStorage.setItem('clientPageLayout', JSON.stringify(newLayout));
  };

  if (loading) {
    return <div className="flex h-full w-full items-center justify-center">Loading Clients...</div>;
  }
  
  const getWidgetProps = (id: string) => {
      switch (id) {
          case 'client-manager':
              return { clients: visibleClients, isPartner };
          default:
              return {};
      }
  };

  return (
    <GridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={30}
        width={1200}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-drag-handle"
    >
        {widgets.map(widget => (
             <div key={widget.id} data-grid={layout.find(l => l.i === widget.id) || widget.defaultLayout}>
                 <Card className="h-full w-full overflow-hidden flex flex-col">
                    <div className="absolute top-2 right-2 z-10 cursor-grab p-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-colors widget-drag-handle">
                        <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="p-4 pb-0 flex-shrink-0">
                      <h2 className="text-3xl font-bold tracking-tight font-headline">{widget.title}</h2>
                      <p className="text-muted-foreground">{widget.description}</p>
                    </div>
                    <div className="p-4 flex-grow flex flex-col min-h-0">
                        <widget.component {...getWidgetProps(widget.id)} />
                    </div>
                     <div className="react-resizable-handle absolute bottom-0 right-0 cursor-se-resize w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Grip className="w-full h-full text-muted-foreground" />
                    </div>
                </Card>
             </div>
        ))}
    </GridLayout>
  );
}
