
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Engagement, Employee, Client, EngagementType, EngagementStatus } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GripVertical, Loader2, Grip } from "lucide-react";
import { ReportsDataTable } from "@/components/reports/data-table";
import { getReportsColumns } from "@/components/reports/columns";
import { EngagementSummaryTable } from "@/components/reports/engagement-summary";
import { EditEngagementSheet } from "@/components/reports/edit-engagement-sheet";
import GridLayout from "react-grid-layout";
import { useRouter } from "next/navigation";


export interface ReportsEngagement extends Engagement {
    clientName: string;
    engagementTypeName: string;
    partnerId?: string; // Add partnerId for the new column
}

interface Widget {
  id: string;
  component: React.FC<any>;
  defaultLayout: { x: number; y: number; w: number; h: number; };
}


export default function ReportsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [tableData, setTableData] = React.useState<ReportsEngagement[]>([]);
    const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
    const [employeeMap, setEmployeeMap] = React.useState<Map<string, {name: string, avatar?: string}>>(new Map());
    
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [selectedEngagement, setSelectedEngagement] = React.useState<ReportsEngagement | null>(null);
    const [widgets, setWidgets] = React.useState<Widget[]>([]);
    const [layout, setLayout] = React.useState<GridLayout.Layout[]>([]);

    React.useEffect(() => {
        if (!user) return;
        
        const checkUserRole = async () => {
            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const employeeSnapshot = await getDocs(employeeQuery);
            if (!employeeSnapshot.empty) {
                const employeeData = employeeSnapshot.docs[0].data() as Employee;
                if (employeeData.role.includes("Partner")) {
                    setHasAccess(true);
                }
            }
            setLoading(false);
        };
        checkUserRole();

    }, [user]);

    React.useEffect(() => {
        if (!hasAccess) return;
        
        const activeStatuses: EngagementStatus[] = ["Pending", "Awaiting Documents", "In Process", "Partner Review"];
        const engagementsQuery = query(collection(db, "engagements"), where("status", "in", activeStatuses));

        const unsubEngagements = onSnapshot(engagementsQuery, (snapshot) => {
            let employeeMapInternal: Map<string, Employee> = new Map();
            let clientMap: Map<string, Client> = new Map();
            let engagementTypeMap: Map<string, EngagementType> = new Map();
            
            Promise.all([
                getDocs(collection(db, "employees")),
                getDocs(collection(db, "clients")),
                getDocs(collection(db, "engagementTypes"))
            ]).then(([employeeSnapshot, clientSnapshot, engagementTypeSnapshot]) => {
                const employeeData = employeeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
                employeeMapInternal = new Map(employeeData.map(s => [s.id, s]));
                setEmployeeMap(new Map(employeeData.map(e => [e.id, { name: e.name, avatar: e.avatar }])));
                setAllEmployees(employeeData);

                clientMap = new Map(clientSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Client]));
                const engagementTypesData = engagementTypeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EngagementType));
                engagementTypeMap = new Map(engagementTypesData.map(et => [et.id, et]));
                
                setEngagementTypes(engagementTypesData);

                const engagementData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));

                const formattedData: ReportsEngagement[] = engagementData.map(eng => {
                    const client = clientMap.get(eng.clientId);
                    const engagementType = engagementTypeMap.get(eng.type);

                    return {
                        ...eng,
                        clientName: client?.Name || 'N/A',
                        engagementTypeName: engagementType?.name || 'N/A',
                        partnerId: client?.partnerId,
                    };
                });
                
                setTableData(formattedData);
            }).catch(err => {
                 toast({ title: "Error", description: "Could not fetch supporting data for engagements", variant: "destructive" })
            });
            
        }, (err) => toast({ title: "Error", description: "Could not fetch engagements", variant: "destructive" }));
        
        return () => {
            unsubEngagements();
        }

    }, [hasAccess, toast]);
    
    React.useEffect(() => {
        const defaultWidgets: Widget[] = [
            { id: 'summary-table', component: EngagementSummaryTable, defaultLayout: { x: 0, y: 0, w: 12, h: 8 } },
            { id: 'data-table', component: ReportsDataTable, defaultLayout: { x: 0, y: 8, w: 12, h: 10 } }
        ];
        
        setWidgets(defaultWidgets);

        const storedLayout = localStorage.getItem('reportsLayout');
        if (storedLayout) {
            setLayout(JSON.parse(storedLayout));
        } else {
            setLayout(defaultWidgets.map(w => ({...w.defaultLayout, i: w.id})));
        }
    }, []);
    
    const handleOpenEditSheet = (engagement: ReportsEngagement) => {
        setSelectedEngagement(engagement);
        setIsSheetOpen(true);
    };

    const handleCloseEditSheet = () => {
        setIsSheetOpen(false);
        setSelectedEngagement(null);
    };
    
    const handleSaveEngagement = async (engagementData: Partial<Engagement>) => {
        if (!selectedEngagement?.id) return;
        try {
            const engagementRef = doc(db, "engagements", selectedEngagement.id);
            await updateDoc(engagementRef, engagementData);
            toast({ title: "Success", description: "Engagement updated successfully." });
            handleCloseEditSheet();
        } catch (error) {
            console.error("Error saving engagement:", error);
            toast({ title: "Error", description: "Failed to save engagement data.", variant: "destructive" });
        }
    };
    
    const handleLayoutChange = (newLayout: GridLayout.Layout[]) => {
        setLayout(newLayout);
        localStorage.setItem('reportsLayout', JSON.stringify(newLayout));
    };
    
    const handleRowClick = (engagementId: string) => {
        router.push(`/workflow/${engagementId}`);
    };

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
    
    const columns = getReportsColumns(
        engagementTypes.map(et => et.name), 
        employeeMap,
        handleOpenEditSheet
    );

    const getWidgetProps = (id: string) => {
        switch (id) {
            case 'summary-table':
                return { engagements: tableData, engagementTypes: engagementTypes };
            case 'data-table':
                return { columns: columns, data: tableData, onRowClick: handleRowClick };
            default:
                return {};
        }
    };

    return (
        <>
             <div className="flex items-center justify-between space-y-2 mb-4">
                <div>
                <h2 className="text-3xl font-bold tracking-tight font-headline">Reports</h2>
                <p className="text-muted-foreground">
                    A comprehensive overview of all firm-wide engagements.
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
                {widgets.map(widget => (
                    <div key={widget.id} data-grid={layout.find(l => l.i === widget.id) || widget.defaultLayout}>
                        <Card className="h-full w-full overflow-hidden flex flex-col">
                             <div className="absolute top-2 right-2 z-10 cursor-grab p-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-colors widget-drag-handle">
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
                ))}
            </GridLayout>
             <EditEngagementSheet
                isOpen={isSheetOpen}
                onClose={handleCloseEditSheet}
                onSave={handleSaveEngagement}
                engagement={selectedEngagement}
                allEmployees={allEmployees}
            />
        </>
    )
}
