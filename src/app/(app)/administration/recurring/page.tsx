
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs, doc, updateDoc, writeBatch, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { RecurringEngagement, Employee, Client, EngagementType } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { RecurringEngagementsTable } from "@/components/recurring/data-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function RecurringEngagementsPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [recurringEngagements, setRecurringEngagements] = React.useState<RecurringEngagement[]>([]);
    const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
    const [engagementTypes, setEngagementTypes] = React.useState<Map<string, EngagementType>>(new Map());

    React.useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setLoading(false);
            return;
        }

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
    }, [user, authLoading]);

    React.useEffect(() => {
        if (!hasAccess) return;

        const unsubRecurring = onSnapshot(collection(db, "recurringEngagements"), (snapshot) => {
            setRecurringEngagements(snapshot.docs.map(doc => doc.data() as RecurringEngagement));
        });
        const unsubClients = onSnapshot(collection(db, "clients"), (snapshot) => {
            setClients(new Map(snapshot.docs.map(doc => [doc.id, doc.data() as Client])));
        });
        const unsubEngagementTypes = onSnapshot(collection(db, "engagementTypes"), (snapshot) => {
            setEngagementTypes(new Map(snapshot.docs.map(doc => [doc.id, doc.data() as EngagementType])));
        });

        return () => {
            unsubRecurring();
            unsubClients();
            unsubEngagementTypes();
        }
    }, [hasAccess]);

    const handleUpdate = async (id: string, field: keyof RecurringEngagement, value: any, originalValue?: any) => {
        const docRef = doc(db, "recurringEngagements", id);
        try {
            const batch = writeBatch(db);
            batch.update(docRef, { [field]: value });

            if (field === 'fees' && value !== originalValue) {
                const todoRef = doc(collection(db, "todos"));
                const recurringEngagement = recurringEngagements.find(re => re.id === id);
                const client = clients.get(recurringEngagement!.clientId);
                if (client && client.partnerId) {
                    batch.set(todoRef, {
                        id: todoRef.id,
                        type: 'FEE_REVISION_APPROVAL',
                        userId: client.partnerId,
                        clientId: client.id,
                        relatedData: {
                            recurringEngagementId: id,
                            oldFee: originalValue,
                            newFee: value,
                            clientName: client.name,
                            engagementTypeName: engagementTypes.get(recurringEngagement!.engagementTypeId)?.name || 'Unknown'
                        },
                        status: 'Pending',
                        createdAt: new Date().toISOString()
                    });
                }
            }

            await batch.commit();
            toast({ title: "Success", description: "Recurring engagement updated." });
        } catch (error) {
            console.error("Error updating recurring engagement:", error);
            toast({ title: "Error", description: "Failed to update.", variant: "destructive" });
        }
    };

    if (loading || authLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!hasAccess) {
        return (
            <Card>
                <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
                <CardContent><p>You do not have permission to view this page.</p></CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Button asChild variant="outline" size="sm">
                <Link href="/administration">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Administration
                </Link>
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>Recurring Engagements</CardTitle>
                    <CardDescription>
                        Manage all recurring service subscriptions for your clients.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <RecurringEngagementsTable
                        data={recurringEngagements}
                        clients={clients}
                        engagementTypes={engagementTypes}
                        onUpdate={handleUpdate}
                    />
                </CardContent>
            </Card>
        </div>
    );
}

