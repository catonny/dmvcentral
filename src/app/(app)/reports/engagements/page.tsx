
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Engagement, Employee, Client, EngagementType, EngagementStatus } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { ReportsDataTable } from "@/components/reports/data-table";
import { getReportsColumns } from "@/components/reports/columns";
import { EditEngagementSheet } from "@/components/reports/edit-engagement-sheet";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EngagementSummaryTable } from "@/components/reports/engagement-summary";

export interface ReportsEngagement extends Engagement {
    clientName: string;
    engagementTypeName: string;
    partnerId?: string;
}

// Note: This component is now client-side only due to the shift from server-side data fetching.
// In a full relational DB migration, this would likely be a server component again.
export default function EngagementsReportPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [tableData, setTableData] = React.useState<ReportsEngagement[]>([]);
    const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
    
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [selectedEngagement, setSelectedEngagement] = React.useState<ReportsEngagement | null>(null);

    const employeeMap = React.useMemo(() => new Map(allEmployees.map(e => [e.id, { name: e.name, avatar: e.avatar }])), [allEmployees]);
    
    React.useEffect(() => {
        if (!user) {
             setLoading(false);
             return;
        };
        
        const checkUserRole = async () => {
            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const employeeSnapshot = await getDocs(employeeQuery);
            if (!employeeSnapshot.empty) {
                const employeeData = employeeSnapshot.docs[0].data() as Employee;
                if (employeeData.role.includes("Partner") || employeeData.role.includes("Admin")) {
                    setHasAccess(true);
                }
            }
            setLoading(false);
        };
        checkUserRole();

    }, [user]);

    // Set up a real-time listener for all necessary data
    React.useEffect(() => {
        if (!hasAccess) return;

        const unsubEngagements = onSnapshot(query(collection(db, "engagements")), (engSnap) => {
             const engagements = engSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
            
             // Fetch other collections to build the final table data
             Promise.all([
                 getDocs(collection(db, "clients")),
                 getDocs(collection(db, "engagementTypes")),
                 getDocs(collection(db, "employees")),
             ]).then(([clientSnap, typeSnap, empSnap]) => {
                const clientMap = new Map(clientSnap.docs.map(d => [d.id, d.data() as Client]));
                const typeMap = new Map(typeSnap.docs.map(d => [d.id, d.data() as EngagementType]));
                const employees = empSnap.docs.map(d => ({id: d.id, ...d.data()} as Employee));

                setAllEmployees(employees);
                setEngagementTypes(Array.from(typeMap.values()));
                
                const newTableData: ReportsEngagement[] = engagements.map(eng => {
                    const client = clientMap.get(eng.clientId);
                    const engagementType = typeMap.get(eng.type);
                    return {
                        ...eng,
                        clientName: client?.name || 'N/A',
                        engagementTypeName: engagementType?.name || 'N/A',
                        partnerId: client?.partnerId,
                    };
                });
                setTableData(newTableData);
             });
        }, (error) => {
            console.error("Failed to listen to engagement updates:", error);
            toast({ title: "Live Update Failed", description: "Could not get real-time engagement updates.", variant: "destructive" });
        });
        
        return () => unsubEngagements();
    }, [hasAccess, toast]);
    
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

    const activeEngagements = tableData.filter(e => e.status !== "Completed" && e.status !== "Cancelled");

    return (
        <div className="space-y-4">
             <Button variant="outline" size="sm" onClick={() => router.push('/reports')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Reports
            </Button>
            
            <EngagementSummaryTable engagements={activeEngagements} engagementTypes={engagementTypes} />

            <CardHeader className="p-0">
                <CardTitle>All Engagements Report</CardTitle>
                <CardDescription>A complete, filterable list of all engagements in the firm.</CardDescription>
            </CardHeader>
             <ReportsDataTable columns={columns} data={tableData} onRowClick={handleRowClick} />
             <EditEngagementSheet
                isOpen={isSheetOpen}
                onClose={handleCloseEditSheet}
                onSave={handleSaveEngagement}
                engagement={selectedEngagement}
                allEmployees={allEmployees}
            />
        </div>
    )
}
