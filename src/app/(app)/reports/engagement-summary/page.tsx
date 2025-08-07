
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Engagement, Employee, Client, EngagementType, EngagementStatus } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { EngagementSummaryTable } from "@/components/reports/engagement-summary";
import { ReportsEngagement } from "../page";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function EngagementSummaryReportPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [engagements, setEngagements] = React.useState<ReportsEngagement[]>([]);
    const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);

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
        const activeStatuses: EngagementStatus[] = ["Pending", "Awaiting Documents", "In Process", "Partner Review", "On Hold"];
        const engagementsQuery = query(collection(db, "engagements"), where("status", "in", activeStatuses));

        const unsubEngagements = onSnapshot(engagementsQuery, (snapshot) => {
             let clientMap: Map<string, Client> = new Map();
             let engagementTypeMap: Map<string, EngagementType> = new Map();

             Promise.all([
                getDocs(collection(db, "clients")),
                getDocs(collection(db, "engagementTypes"))
             ]).then(([clientSnapshot, engagementTypeSnapshot]) => {
                clientMap = new Map(clientSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Client]));
                const engagementTypesData = engagementTypeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EngagementType));
                engagementTypeMap = new Map(engagementTypesData.map(et => [et.id, et]));
                setEngagementTypes(engagementTypesData);

                const engagementData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
                const formattedData: ReportsEngagement[] = engagementData.map(eng => ({
                    ...eng,
                    clientName: clientMap.get(eng.clientId)?.Name || 'N/A',
                    engagementTypeName: engagementTypeMap.get(eng.type)?.name || 'N/A',
                }));
                setEngagements(formattedData);
             });
        });
        
        return () => unsubEngagements();

    }, [hasAccess, toast]);

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

    return (
        <div className="space-y-4">
             <Button variant="outline" size="sm" onClick={() => router.push('/reports')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Reports
            </Button>
            <EngagementSummaryTable engagements={engagements} engagementTypes={engagementTypes} />
        </div>
    )
}
