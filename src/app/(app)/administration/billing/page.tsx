
"use client";

import * as React from "react";
import { collection, query, onSnapshot, getDocs, doc, updateDoc, deleteDoc, getDoc, writeBatch, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Engagement, Client, BillStatus, PendingInvoice, EngagementType, Employee } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { generateInvoice } from "@/ai/flows/generate-invoice-flow";
import { sendEmail } from "@/ai/flows/send-email-flow";
import { Badge } from "@/components/ui/badge";


const BILL_STATUSES: BillStatus[] = ["To Bill", "Pending Collection", "Collected"];

interface BillingDashboardEntry {
    engagement: Engagement;
    pendingInvoiceId: string;
}

export default function BillingDashboardPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [billingEntries, setBillingEntries] = React.useState<BillingDashboardEntry[]>([]);
    const [unbilledCount, setUnbilledCount] = React.useState(0);
    const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
    const [employees, setEmployees] = React.useState<Map<string, Employee>>(new Map());
    const [engagementTypes, setEngagementTypes] = React.useState<Map<string, EngagementType>>(new Map());
    
    const [pageSize, setPageSize] = React.useState(10);
    const [pageIndex, setPageIndex] = React.useState(0);
    const [processingInvoiceId, setProcessingInvoiceId] = React.useState<string | null>(null);

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
        const unsubPending = onSnapshot(q, async (snapshot) => {
            const pendingInvoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingInvoice));
            
            if (pendingInvoices.length === 0) {
                setBillingEntries([]);
                return;
            }

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

        // Fetch unbilled engagements count
        const unbilledQuery = query(collection(db, "engagements"), where("status", "==", "Completed"));
        const unsubUnbilled = onSnapshot(unbilledQuery, (snapshot) => {
            const completedEngagements = snapshot.docs.map(doc => doc.data() as Engagement);
            const unbilled = completedEngagements.filter(eng => !eng.billStatus);
            setUnbilledCount(unbilled.length);
        });

        return () => {
            unsubPending();
            unsubUnbilled();
        }
    }, [toast]);
    
    const handleGenerateAndSendInvoice = async (engagementId: string, pendingInvoiceId: string) => {
        setProcessingInvoiceId(engagementId);
        try {
            // 1. AI generates the invoice
            toast({ title: "Generating Invoice...", description: "The AI is creating the invoice." });
            const invoiceData = await generateInvoice({ engagementId });

            // 2. Send the invoice via email
            toast({ title: "Sending Email...", description: `Sending invoice to ${invoiceData.recipientEmail}.` });
            await sendEmail({
                recipientEmails: [invoiceData.recipientEmail],
                subject: invoiceData.subject,
                body: invoiceData.htmlContent,
            });
            
            // 3. Update database state
            const batch = writeBatch(db);
            const engagementRef = doc(db, "engagements", engagementId);
            batch.update(engagementRef, { billStatus: "Pending Collection" });
            
            const pendingInvoiceRef = doc(db, "pendingInvoices", pendingInvoiceId);
            batch.delete(pendingInvoiceRef);

            await batch.commit();

            toast({ title: "Success!", description: "Invoice generated and sent to the client." });

        } catch (error) {
            console.error("Error processing invoice:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ title: "Invoice Processing Failed", description: errorMessage, variant: "destructive" });
        } finally {
            setProcessingInvoiceId(null);
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
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle>Billing Pending Dashboard</CardTitle>
                        <CardDescription>Engagements submitted for billing and awaiting processing.</CardDescription>
                    </div>
                     {unbilledCount > 0 && (
                        <Button variant="outline" className="relative" asChild>
                           <Link href="/reports/exceptions/unbilled-engagements">
                                <AlertTriangle className="mr-2 h-4 w-4 text-destructive" />
                                Unbilled Engagements
                                <Badge variant="destructive" className="absolute -top-2 -right-2">
                                    {unbilledCount}
                                </Badge>
                           </Link>
                        </Button>
                    )}
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
                                        const isProcessing = processingInvoiceId === engagement.id;

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
                                                        onClick={() => handleGenerateAndSendInvoice(engagement.id, pendingInvoiceId)}
                                                        disabled={isProcessing}
                                                    >
                                                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                        Generate & Send Invoice
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

    