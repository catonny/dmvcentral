
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
import { getAdminApp } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { AlertCircle } from "lucide-react";


export interface ReportsEngagement extends Engagement {
    clientName: string;
    engagementTypeName: string;
    partnerId?: string;
}

async function getReportData() {
    const adminApp = getAdminApp();
    if (!adminApp) {
        throw new Error("Firebase admin SDK not configured.");
    }
    const db = getFirestore(adminApp);

    try {
        const [engagementsSnap, clientsSnap, employeesSnap, engagementTypesSnap] = await Promise.all([
            db.collection('engagements').get(),
            db.collection('clients').get(),
            db.collection('employees').get(),
            db.collection('engagementTypes').get()
        ]);

        const engagements = engagementsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
        const clients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        const engagementTypes = engagementTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EngagementType));

        return { engagements, clients, employees, engagementTypes };

    } catch (error) {
        console.error("Error fetching report data from Firestore:", error);
        throw new Error("Could not fetch data from Firestore.");
    }
}


export default async function EngagementsReportPage() {
    
    try {
        const { engagements, clients, employees, engagementTypes } = await getReportData();

        const clientMap = new Map(clients.map(c => [c.id, c]));
        const engagementTypeMap = new Map(engagementTypes.map(et => [et.id, et]));

        const tableData: ReportsEngagement[] = engagements.map(eng => {
            const client = clientMap.get(eng.clientId);
            const engagementType = engagementTypeMap.get(eng.type);
            return {
                ...eng,
                clientName: client?.Name || 'N/A',
                engagementTypeName: engagementType?.name || 'N/A',
                partnerId: client?.partnerId,
            };
        });

        return <EngagementsReportClient initialData={{ tableData, engagementTypes, allEmployees: employees }} />;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <AlertCircle /> Error Loading Report
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p>{errorMessage}</p>
                    <p className="text-sm text-muted-foreground mt-2">There was an issue loading report data from the server. Please check your Firebase configuration.</p>
                </CardContent>
            </Card>
        )
    }
}


function EngagementsReportClient({ initialData }: { initialData: { tableData: ReportsEngagement[], engagementTypes: EngagementType[], allEmployees: Employee[] }}) {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [tableData, setTableData] = React.useState<ReportsEngagement[]>(initialData.tableData);
    const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>(initialData.engagementTypes);
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>(initialData.allEmployees);
    
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

    // Set up a real-time listener ONLY for the data that might change
    React.useEffect(() => {
        const q = query(collection(db, "engagements"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
             const newEngagements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
             const clientMap = new Map(initialData.tableData.map(d => [d.clientId, d.clientName]));
             const typeMap = new Map(initialData.engagementTypes.map(d => [d.id, d.name]));
             
             const newTableData = newEngagements.map(eng => {
                const client = initialData.tableData.find(d => d.clientId === eng.clientId);
                return {
                    ...eng,
                    clientName: client?.clientName || 'N/A',
                    engagementTypeName: typeMap.get(eng.type) || 'N/A',
                    partnerId: client?.partnerId,
                }
             });
             setTableData(newTableData);
        }, (error) => {
            console.error("Failed to listen to engagement updates:", error);
            toast({ title: "Live Update Failed", description: "Could not get real-time engagement updates.", variant: "destructive" });
        });
        return () => unsubscribe();
    }, [initialData.tableData, initialData.engagementTypes, toast]);
    
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

