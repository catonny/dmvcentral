
"use client";

import * as React from "react";
import { collection, query, onSnapshot, getDocs, doc, updateDoc, deleteDoc, getDoc, writeBatch, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Engagement, Client, BillStatus, PendingInvoice, EngagementType, Employee, Firm, SalesItem, TaxRate, HsnSacCode } from "@/lib/data";
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
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GenerateInvoiceDialog } from "@/components/administration/generate-invoice-dialog";

interface BillingDashboardEntry {
    engagement: Engagement;
    pendingInvoiceId: string;
    client: Client;
    engagementType: EngagementType;
}

export default function BillingDashboardPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [billingEntries, setBillingEntries] = React.useState<BillingDashboardEntry[]>([]);
    const [unbilledCount, setUnbilledCount] = React.useState(0);
    const [employees, setEmployees] = React.useState<Map<string, Employee>>(new Map());
    const [firms, setFirms] = React.useState<Firm[]>([]);
    const [salesItems, setSalesItems] = React.useState<SalesItem[]>([]);
    const [taxRates, setTaxRates] = React.useState<TaxRate[]>([]);
    const [hsnSacCodes, setHsnSacCodes] = React.useState<HsnSacCode[]>([]);
    
    const [pageSize, setPageSize] = React.useState(10);
    const [pageIndex, setPageIndex] = React.useState(0);
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = React.useState(false);
    const [selectedEntry, setSelectedEntry] = React.useState<BillingDashboardEntry | null>(null);

    React.useEffect(() => {
        const fetchAndSetStaticData = async () => {
            try {
                const [employeeSnapshot, firmSnapshot, salesItemSnapshot, taxRateSnapshot, hsnSacSnapshot] = await Promise.all([
                    getDocs(collection(db, "employees")),
                    getDocs(collection(db, "firms")),
                    getDocs(collection(db, "salesItems")),
                    getDocs(collection(db, "taxRates")),
                    getDocs(collection(db, "hsnSacCodes")),
                ]);
                setEmployees(new Map(employeeSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Employee])));
                setFirms(firmSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Firm)));
                setSalesItems(salesItemSnapshot.docs.map(doc => doc.data() as SalesItem));
                setTaxRates(taxRateSnapshot.docs.map(doc => doc.data() as TaxRate));
                setHsnSacCodes(hsnSacSnapshot.docs.map(doc => doc.data() as HsnSacCode));

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

            const clientIds = new Set(engagementSnapshots.map(snap => snap.data()?.clientId).filter(Boolean));
            const engagementTypeIds = new Set(engagementSnapshots.map(snap => snap.data()?.type).filter(Boolean));
            
            const [clientSnapshot, engagementTypeSnapshot] = await Promise.all([
                getDocs(query(collection(db, "clients"), where("id", "in", Array.from(clientIds)))),
                getDocs(query(collection(db, "engagementTypes"), where("id", "in", Array.from(engagementTypeIds))))
            ]);
            
            const clientMap = new Map(clientSnapshot.docs.map(doc => [doc.id, {id: doc.id, ...doc.data()} as Client]));
            const engagementTypeMap = new Map(engagementTypeSnapshot.docs.map(doc => [doc.id, {id: doc.id, ...doc.data()} as EngagementType]));

            const fetchedEntries: BillingDashboardEntry[] = engagementSnapshots
                .map((engSnap, index) => {
                    if (engSnap.exists()) {
                        const engagement = { id: engSnap.id, ...engSnap.data() } as Engagement;
                        const client = clientMap.get(engagement.clientId);
                        const engagementType = engagementTypeMap.get(engagement.type);

                        if (client && engagementType) {
                             return {
                                engagement,
                                client,
                                engagementType,
                                pendingInvoiceId: pendingInvoices[index].id,
                            };
                        }
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
    
    const handleGenerateInvoice = (entry: BillingDashboardEntry) => {
        setSelectedEntry(entry);
        setIsInvoiceDialogOpen(true);
    };

    const handleSaveInvoice = async (engagementId: string, fee: number) => {
        try {
            const batch = writeBatch(db);
            const engagementRef = doc(db, "engagements", engagementId);
            batch.update(engagementRef, { billStatus: "Pending Collection", fees: fee });
            
            const pendingInvoice = billingEntries.find(be => be.engagement.id === engagementId);
            if(pendingInvoice) {
                const pendingInvoiceRef = doc(db, "pendingInvoices", pendingInvoice.pendingInvoiceId);
                batch.delete(pendingInvoiceRef);
            }

            await batch.commit();

            toast({ title: "Success!", description: "Engagement marked as billed and moved to collections." });
            setIsInvoiceDialogOpen(false);
            setSelectedEntry(null);

        } catch (error) {
            console.error("Error processing invoice:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ title: "Processing Failed", description: errorMessage, variant: "destructive" });
        }
    };

    const paginatedEntries = billingEntries.slice(
        pageIndex * pageSize,
        (pageIndex + 1) * pageSize
    );
    const pageCount = Math.ceil(billingEntries.length / pageSize);
    
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
                                            const { engagement } = entry;
                                            const client = entry.client;
                                            const partner = employees.get(client.partnerId);
                                            const assignedToNames = engagement.assignedTo.map(id => employees.get(id)?.name).filter(Boolean).join(", ");
                                            
                                            return (
                                                <TableRow key={engagement.id}>
                                                    <TableCell>{engagement.billSubmissionDate ? format(parseISO(engagement.billSubmissionDate), "dd MMM, yyyy") : 'N/A'}</TableCell>
                                                    <TableCell>{client.name || 'Unknown Client'}</TableCell>
                                                    <TableCell>{partner?.name || 'N/A'}</TableCell>
                                                    <TableCell>{entry.engagementType?.name || 'N/A'}</TableCell>
                                                    <TableCell>{assignedToNames || 'N/A'}</TableCell>
                                                    <TableCell>{engagement.remarks}</TableCell>
                                                    <TableCell className="text-right">
                                                         <Button onClick={() => handleGenerateInvoice(entry)}>
                                                            Generate Invoice
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center h-24">No new engagements submitted for billing.</TableCell>
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
            <GenerateInvoiceDialog
                isOpen={isInvoiceDialogOpen}
                onClose={() => setIsInvoiceDialogOpen(false)}
                onSave={handleSaveInvoice}
                entry={selectedEntry}
                firms={firms}
                salesItems={salesItems}
                taxRates={taxRates}
                hsnSacCodes={hsnSacCodes}
            />
        </>
    );
}
