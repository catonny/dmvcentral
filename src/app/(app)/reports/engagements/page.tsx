
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
    const [tableData, setTableData] = React.useState<ReportsEngagement[]>([]);
    const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
    const [employeeMap, setEmployeeMap] = React.useState<Map<string, {name: string, avatar?: string}>>(new Map());
    
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [selectedEngagement, setSelectedEngagement] = React.useState<ReportsEngagement | null>(null);

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
        
        const engagementsQuery = query(collection(db, "engagements"));

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
