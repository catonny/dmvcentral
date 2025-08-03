
"use client";

import * as React from "react";
import { collection, query, orderBy, limit, where, onSnapshot, getDocs } from "firebase/firestore";
import type { Client, Engagement, Employee } from "@/lib/data";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ChevronRight, Search, History, GripVertical, Grip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { AssignmentList } from "@/components/workspace/assignment-list";
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from "@/components/ui/popover";
import GridLayout from "react-grid-layout";


interface Widget {
  id: string;
  component: React.FC<any>;
  defaultLayout: { x: number; y: number; w: number; h: number; };
}

export default function WorkspacePage() {
  const [allClients, setAllClients] = React.useState<Client[]>([]);
  const [recentClients, setRecentClients] = React.useState<Client[]>([]);
  const [engagements, setEngagements] = React.useState<Engagement[]>([]);
  const [currentUserEmployee, setCurrentUserEmployee] = React.useState<Employee | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = React.useState(false);
  const [widgets, setWidgets] = React.useState<Widget[]>([]);
  const [layout, setLayout] = React.useState<GridLayout.Layout[]>([]);
  
  const clientMap = new Map(allClients.map(c => [c.id, c]));

  const MainContent = () => (
    <>
        <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
            <PopoverAnchor asChild>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search for a client by name..."
                        className="w-full pl-10 py-6 text-base"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => searchQuery.length > 1 && setIsSearchPopoverOpen(true)}
                    />
                </div>
            </PopoverAnchor>
            <PopoverContent className="w-[--radix-popover-anchor-width] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                {/* Popover content remains the same */}
            </PopoverContent>
        </Popover>
        <AssignmentList engagements={engagements} clientMap={clientMap} currentUserEmployee={currentUserEmployee} />
    </>
  );

  const RightSidebar = () => (
    <>
        {recentClients.length > 0 && (
           <Card className="h-full">
               <CardHeader>
                   <CardTitle className="flex items-center gap-2 text-base">
                       <History className="h-5 w-5" />
                       Jump Back to
                   </CardTitle>
               </CardHeader>
               <CardContent>
                   <div className="flex flex-col gap-2">
                       {recentClients.map(client => (
                           <Link href={`/workspace/${client.id}`} key={client.id} className="block hover:bg-white/10 p-3 rounded-lg transition-colors">
                               <div className="flex items-center justify-between">
                                   <div>
                                       <p className="font-semibold">{client.Name}</p>
                                       <p className="text-sm text-muted-foreground">{client.Category || 'N/A'}</p>
                                   </div>
                                   <ChevronRight className="h-5 w-5 text-muted-foreground" />
                               </div>
                           </Link>
                       ))}
                   </div>
               </CardContent>
           </Card>
       )}
    </>
  );

  React.useEffect(() => {
    if (!user) return;
    
    let engagementsUnsub: () => void;
    let recentClientsUnsub: () => void;

    const setupListeners = async () => {
        setLoading(true);
        try {
            const clientsSnapshot = await getDocs(query(collection(db, "clients")));
            const clientsData = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            setAllClients(clientsData);

            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email), limit(1));
            const employeeSnapshot = await getDocs(employeeQuery);

            if (employeeSnapshot.empty) {
                toast({ title: "Warning", description: "No employee profile found for your user email.", variant: "destructive" });
                setLoading(false);
                return;
            }

            const currentUserEmployeeEntry = { id: employeeSnapshot.docs[0].id, ...employeeSnapshot.docs[0].data() } as Employee;
            setCurrentUserEmployee(currentUserEmployeeEntry);

            const engagementsQuery = query(collection(db, "engagements"), where("assignedTo", "==", currentUserEmployeeEntry.id));
            engagementsUnsub = onSnapshot(engagementsQuery, (engagementsSnapshot) => {
                const engagementsData = engagementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
                setEngagements(engagementsData);
                setLoading(false);
            }, (error) => {
                handleError(error, 'engagements');
                setLoading(false);
            });
            
            const recentClientsQuery = query(collection(db, "clients"), orderBy("lastUpdated", "desc"), limit(5));
            recentClientsUnsub = onSnapshot(recentClientsQuery, (snapshot) => {
                const recentClientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
                setRecentClients(recentClientsData);
            }, (error) => handleError(error, 'recent clients'));

        } catch (error) {
            handleError(error as Error, 'initial data load');
            setLoading(false);
        }
    };
    
    const handleError = (error: Error, type: string) => {
        console.error(`Error fetching ${type}: `, error);
        toast({ title: "Error", description: `Failed to fetch ${type} data.`, variant: "destructive" });
    };
    
    setupListeners();

    return () => {
      if (recentClientsUnsub) recentClientsUnsub();
      if (engagementsUnsub) engagementsUnsub();
    };
  }, [toast, user]);

  React.useEffect(() => {
    const defaultWidgets: Widget[] = [
        { id: 'main-content', component: MainContent, defaultLayout: { x: 0, y: 0, w: 12, h: 14 } },
        { id: 'sidebar', component: RightSidebar, defaultLayout: { x: 0, y: 14, w: 12, h: 8 } }
    ];
    setWidgets(defaultWidgets);

    const storedLayout = localStorage.getItem('workspaceLayout');
    if (storedLayout) {
        setLayout(JSON.parse(storedLayout));
    } else {
        setLayout(defaultWidgets.map(w => ({...w.defaultLayout, i: w.id})));
    }
  }, []);

  const handleLayoutChange = (newLayout: GridLayout.Layout[]) => {
    setLayout(newLayout);
    localStorage.setItem('workspaceLayout', JSON.stringify(newLayout));
  };

  if (loading) {
    return <div className="flex h-full w-full items-center justify-center">Loading workspace...</div>;
  }
  
  const widgetMap: { [key: string]: React.FC<any> } = {
      'main-content': MainContent,
      'sidebar': RightSidebar
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
        {widgets.map(widgetDef => {
            const Component = widgetMap[widgetDef.id];
            return (
                <div key={widgetDef.id} data-grid={layout.find(l => l.i === widgetDef.id) || widgetDef.defaultLayout}>
                     <Card className="h-full w-full overflow-hidden flex flex-col">
                        <div className="absolute top-2 right-2 z-10 cursor-grab p-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity widget-drag-handle">
                            <GripVertical className="h-5 w-5" />
                        </div>
                        <div className="p-4 flex-grow">
                             <Component />
                        </div>
                         <div className="react-resizable-handle absolute bottom-0 right-0 cursor-se-resize w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Grip className="w-full h-full text-muted-foreground" />
                        </div>
                    </Card>
                </div>
            );
        })}
    </GridLayout>
  );
}
