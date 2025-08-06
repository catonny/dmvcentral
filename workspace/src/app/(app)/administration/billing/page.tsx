
"use client";

import * as React from "react";
import { collection, query, onSnapshot, getDocs, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Engagement, Client, BillStatus, PendingInvoice, EngagementType, Employee } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";


const BILL_STATUSES: BillStatus[] = ["To Bill", "Pending Collection", "Collected"];

interface BillingDashboardEntry {
    engagement: Engagement;
    pendingInvoiceId: string;
}

export default function BillingDashboardPage() {
    const { toast } = useToast();
    const router = useRouter();
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
        <div className="space-y-6">
            <Button variant="outline" size="sm" onClick={() => router.push('/administration')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Administration
            </Button>
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
        </div>
    );
}
