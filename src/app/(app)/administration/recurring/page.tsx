
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs, doc, updateDoc, writeBatch, addDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { RecurringEngagement, Employee, Client, EngagementType } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, PlusCircle } from "lucide-react";
import { RecurringEngagementsTable } from "@/components/recurring/data-table";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AddRecurringEngagementDialog } from "@/components/recurring/add-recurring-engagement-dialog";

export default function RecurringEngagementsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [recurringEngagements, setRecurringEngagements] = React.useState<RecurringEngagement[]>([]);
    const [clients, setClients] = React.useState<Client[]>([]);
    const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);
    const [employees, setEmployees] = React.useState<Employee[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);

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
            setRecurringEngagements(snapshot.docs.map(doc => ({...doc.data(), id: doc.id} as RecurringEngagement)));
        });
        const unsubClients = onSnapshot(collection(db, "clients"), (snapshot) => {
            setClients(snapshot.docs.map(doc => ({...doc.data(), id: doc.id} as Client)));
        });
        const unsubEngagementTypes = onSnapshot(collection(db, "engagementTypes"), (snapshot) => {
            setEngagementTypes(snapshot.docs.map(doc => ({...doc.data(), id: doc.id} as EngagementType)));
        });
        const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
            setEmployees(snapshot.docs.map(doc => ({...doc.data(), id: doc.id} as Employee)));
        });

        return () => {
            unsubRecurring();
            unsubClients();
            unsubEngagementTypes();
            unsubEmployees();
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
                const client = clients.find(c => c.id === recurringEngagement!.clientId);
                if (client && client.partnerId) {
                    batch.set(todoRef, {
                        id: todoRef.id,
                        type: 'FEE_REVISION_APPROVAL',
                        createdBy: 'system',
                        assignedTo: [client.partnerId],
                        text: `Approve fee revision for ${engagementTypes.find(et => et.id === recurringEngagement!.engagementTypeId)?.name || 'Unknown'} for client ${client.name} from ₹${originalValue} to ₹${value}.`,
                        relatedEntity: {
                            type: 'engagement', // Not a perfect fit, but best available
                            id: id
                        },
                        isCompleted: false,
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
    
    const handleCreate = async (data: Omit<RecurringEngagement, 'id'>) => {
        try {
            const newDocRef = doc(collection(db, "recurringEngagements"));
            const newEngagement = { ...data, id: newDocRef.id };
            await setDoc(newDocRef, newEngagement);
            toast({ title: "Success", description: "New recurring engagement has been created." });
            setIsAddDialogOpen(false);
        } catch (error) {
             console.error("Error creating recurring engagement:", error);
            toast({ title: "Error", description: "Failed to create new recurring engagement.", variant: "destructive" });
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

    const recurringEngagementTypes = engagementTypes.filter(et => et.recurrence);

    return (
        <>
            <div className="space-y-6">
                <Button variant="outline" size="sm" onClick={() => router.push('/administration')} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Administration
                </Button>
                <Card>
                    <CardHeader className="flex flex-row items-start justify-between">
                        <div>
                            <CardTitle>Recurring Engagements</CardTitle>
                            <CardDescription>
                                Manage all recurring service subscriptions for your clients.
                            </CardDescription>
                        </div>
                        <Button onClick={() => setIsAddDialogOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Recurring Engagement
                        </Button>
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
            <AddRecurringEngagementDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                onSave={handleCreate}
                clients={clients}
                engagementTypes={recurringEngagementTypes}
                employees={employees}
            />
        </>
    );
}
