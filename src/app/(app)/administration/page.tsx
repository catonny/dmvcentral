
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs, doc, updateDoc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Engagement, Employee, Client, BillStatus, PendingInvoice, EngagementType } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmailCenter } from "@/components/administration/email-center";


const BILL_STATUSES: BillStatus[] = ["To Bill", "Pending Collection", "Collected"];

interface BillingDashboardEntry {
    engagement: Engagement;
    pendingInvoiceId: string;
}

const BillingDashboard = () => {
    const { toast } = useToast();
    const [billingEntries, setBillingEntries] = React.useState<BillingDashboardEntry[]>([]);
    const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
    const [employees, setEmployees] = React.useState<Map<string, Employee>>(new Map());
    const [engagementTypes, setEngagementTypes] = React.useState<Map<string, EngagementType>>(new Map());
    
    const [pageSize, setPageSize] = React.useState(10);
    const [pageIndex, setPageIndex] = React.useState(0);

    React.useEffect(() => {
        const fetchAndSetStaticData = async () => {
            try {
                const [clientSnapshot, employeeSnapshot, engagementTypeSnapshot] = await Promise.all([
                    getDocs(collection(db, "clients")),
                    getDocs(collection(db, "employees")),
                    getDocs(collection(db, "engagementTypes"))
                ]);
                setClients(new Map(clientSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Client])));
                setEmployees(new Map(employeeSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Employee])));
                setEngagementTypes(new Map(engagementTypeSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as EngagementType])));

            } catch (error) {
                 console.error("Error fetching static data:", error);
                 toast({ title: "Error", description: "Could not fetch supporting data.", variant: "destructive" });
            }
        };

        fetchAndSetStaticData();

        const q = query(collection(db, "pendingInvoices"));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const pendingInvoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingInvoice));
            
            const engagementPromises = pendingInvoices.map(pi => getDoc(doc(db, "engagements", pi.engagementId)));
            const engagementSnapshots = await Promise.all(engagementPromises);

            const fetchedEntries: BillingDashboardEntry[] = engagementSnapshots
                .map((engSnap, index) => {
                    if (engSnap.exists()) {
                        return {
                            engagement: { id: engSnap.id, ...engSnap.data() } as Engagement,
                            pendingInvoiceId: pendingInvoices[index].id,
                        };
                    }
                    return null;
                })
                .filter((entry): entry is BillingDashboardEntry => entry !== null);
            
            setBillingEntries(fetchedEntries);
        }, (error) => {
            console.error("Error fetching billing engagements:", error);
            toast({ title: "Error", description: "Could not fetch billing data.", variant: "destructive" });
        });

        return () => unsubscribe();
    }, [toast]);
    
    const handleBillStatusUpdate = async (engagementId: string, newStatus: BillStatus, pendingInvoiceId: string) => {
        const engagementRef = doc(db, "engagements", engagementId);
        try {
            await updateDoc(engagementRef, { billStatus: newStatus });
            
            if (newStatus !== "To Bill") {
                await deleteDoc(doc(db, "pendingInvoices", pendingInvoiceId));
            }

            toast({ title: "Success", description: "Bill status updated." });
        } catch (error) {
            console.error("Error updating bill status:", error);
            toast({ title: "Error", description: "Failed to update bill status.", variant: "destructive" });
        }
    };

    const paginatedEntries = billingEntries.slice(
        pageIndex * pageSize,
        (pageIndex + 1) * pageSize
    );
    const pageCount = Math.ceil(billingEntries.length / pageSize);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Billing Pending Dashboard</CardTitle>
                <CardDescription>Engagements submitted for billing and awaiting processing.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="w-full whitespace-nowrap">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Partner</TableHead>
                                <TableHead>Engagement Type</TableHead>
                                <TableHead>Assigned To</TableHead>
                                <TableHead>Remarks</TableHead>
                                <TableHead className="text-right"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedEntries.length > 0 ? (
                                paginatedEntries.map(entry => {
                                    const { engagement, pendingInvoiceId } = entry;
                                    const client = clients.get(engagement.clientId);
                                    const partner = client ? employees.get(client.partnerId) : undefined;
                                    const assignedToNames = engagement.assignedTo.map(id => employees.get(id)?.name).filter(Boolean).join(", ");
                                    const engagementType = engagementTypes.get(engagement.type);

                                    return (
                                        <TableRow key={engagement.id}>
                                            <TableCell>{engagement.billSubmissionDate ? format(parseISO(engagement.billSubmissionDate), "dd MMM, yyyy") : 'N/A'}</TableCell>
                                            <TableCell>{client?.name || 'Unknown Client'}</TableCell>
                                            <TableCell>{partner?.name || 'N/A'}</TableCell>
                                            <TableCell>{engagementType?.name || 'N/A'}</TableCell>
                                            <TableCell>{assignedToNames || 'N/A'}</TableCell>
                                            <TableCell>{engagement.remarks}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    onClick={() => handleBillStatusUpdate(engagement.id, "Pending Collection", pendingInvoiceId)}
                                                >
                                                    Generate Invoice
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24">No engagements pending for billing.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <ScrollBar orientation="vertical" />
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
             <div className="flex items-center justify-between space-x-2 py-4 px-6 border-t border-white/10">
                <div className="flex-1 text-sm text-muted-foreground">
                    {billingEntries.length} total row(s).
                </div>
                <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">Rows per page</p>
                    <Select
                        value={`${pageSize}`}
                        onValueChange={(value) => setPageSize(Number(value))}
                    >
                        <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[10, 25, 50].map((size) => (
                                <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPageIndex(p => p - 1)}
                        disabled={pageIndex === 0}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPageIndex(p => p + 1)}
                        disabled={pageIndex >= pageCount - 1}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </Card>
    );
}

export default function AdministrationPage() {
    const { user, loading: authLoading } = useAuth();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    
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
                if (employeeData.role.includes("Partner") || employeeData.role.includes("Administration")) {
                    setHasAccess(true);
                }
            }
            setLoading(false);
        };
        checkUserRole();
    }, [user, authLoading]);

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
                <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
                <CardContent><p>You do not have the required permissions to view this page.</p></CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">Administration</h2>
                    <p className="text-muted-foreground">
                        Manage firm-wide administrative tasks like billing and client communication.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="billing" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="billing">Billing Dashboard</TabsTrigger>
                    <TabsTrigger value="email">Email Center</TabsTrigger>
                </TabsList>
                <TabsContent value="billing" className="space-y-4">
                    <BillingDashboard />
                </TabsContent>
                <TabsContent value="email" className="space-y-4">
                    <EmailCenter />
                </TabsContent>
            </Tabs>
        </div>
    )
}
