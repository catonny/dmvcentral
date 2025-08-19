
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Engagement, Employee, Client, EngagementType, EngagementStatus } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { ReportsDataTable } from "@/components/reports/data-table";
import { getReportsColumns } from "@/components/reports/columns";
import { EditEngagementSheet } from "@/components/reports/edit-engagement-sheet";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EngagementSummaryTable } from "@/components/reports/engagement-summary";
import { AlertCircle } from "lucide-react";

export interface ReportsEngagement extends Engagement {
    clientName: string;
    engagementTypeName: string;
    partnerId?: string;
}

export default function EngagementsReportPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    
    const [engagements, setEngagements] = React.useState<Engagement[]>([]);
    const [clients, setClients] = React.useState<Client[]>([]);
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
    const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);

    const [tableData, setTableData] = React.useState<ReportsEngagement[]>([]);
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
                if (employeeData.role.includes("Partner") || employeeData.role.includes("Admin") || employeeData.role.includes("Administration")) {
                    setHasAccess(true);
                }
            }
        };
        checkUserRole();
    }, [user]);

    React.useEffect(() => {
        if (!hasAccess) {
            setLoading(false);
            return;
        }

        const unsubEngs = onSnapshot(collection(db, "engagements"), (snap) => setEngagements(snap.docs.map(d => ({id: d.id, ...d.data()} as Engagement))));
        const unsubClients = onSnapshot(collection(db, "clients"), (snap) => setClients(snap.docs.map(d => ({id: d.id, ...d.data()} as Client))));
        const unsubEmps = onSnapshot(collection(db, "employees"), (snap) => setAllEmployees(snap.docs.map(d => ({id: d.id, ...d.data()} as Employee))));
        const unsubEngTypes = onSnapshot(collection(db, "engagementTypes"), (snap) => {
            setEngagementTypes(snap.docs.map(d => ({id: d.id, ...d.data()} as EngagementType)));
            setLoading(false);
        });

        return () => {
            unsubEngs();
            unsubClients();
            unsubEmps();
            unsubEngTypes();
        }
    }, [hasAccess]);

    React.useEffect(() => {
        if(engagements.length && clients.length && engagementTypes.length) {
            const clientMap = new Map(clients.map(c => [c.id, c]));
            const engagementTypeMap = new Map(engagementTypes.map(et => [et.id, et]));

            const newData: ReportsEngagement[] = engagements.map(eng => {
                const client = clientMap.get(eng.clientId);
                const engagementType = engagementTypeMap.get(eng.type);
                return {
                    ...eng,
                    clientName: client?.name || 'N/A',
                    engagementTypeName: engagementType?.name || 'N/A',
                    partnerId: client?.partnerId,
                };
            });
            setTableData(newData);
        }
    }, [engagements, clients, engagementTypes]);
    
    const handleOpenEditSheet = (engagement: ReportsEngagement) => {
        setSelectedEngagement(engagement);
        setIsSheetOpen(true);
    };

    const handleCloseEditSheet = () => {
        setIsSheetOpen(false);
        setSelectedEngagement(null);
    };
    
    const handleSaveEngagement = async (engagementData: Partial<ReportsEngagement>) => {
        if (!selectedEngagement?.id) return;
        try {
            const engagementRef = doc(db, "engagements", selectedEngagement.id);
            // Remove the helper properties before updating
            const { clientName, engagementTypeName, partnerId, ...dataToUpdate } = engagementData;
            await updateDoc(engagementRef, dataToUpdate);
            toast({ title: "Success", description: "Engagement updated successfully." });
            handleCloseEditSheet();
        } catch (error) {
            console.error("Error saving engagement:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ title: "Error", description: `Failed to save engagement data: ${errorMessage}`, variant: "destructive" });
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
                allClients={clients}
            />
        </div>
    )
}
