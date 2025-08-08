
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Client, Engagement, Employee } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format, parseISO } from "date-fns";

export default function UnbilledEngagementsReportPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = React.useState(true);
    const [engagements, setEngagements] = React.useState<Engagement[]>([]);
    const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
    const [processingIds, setProcessingIds] = React.useState<string[]>([]);
    const [isSubmittingAll, setIsSubmittingAll] = React.useState(false);

    React.useEffect(() => {
        setLoading(true);

        const fetchStaticData = async () => {
             const [clientsSnapshot] = await Promise.all([
                getDocs(collection(db, "clients")),
            ]);
            setClients(new Map(clientsSnapshot.docs.map(doc => [doc.id, doc.data() as Client])));
        }
        fetchStaticData();
        
        const q = query(collection(db, "engagements"), 
            where("status", "==", "Completed")
        );
        
        const unsub = onSnapshot(q, (snapshot) => {
            const allCompleted = snapshot.docs.map(doc => doc.data() as Engagement);
            // Filter in code to avoid Firestore query issues with null/undefined
            const unbilled = allCompleted.filter(eng => !eng.billStatus);
            setEngagements(unbilled);
            setLoading(false);
        }, (err) => {
            toast({variant: "destructive", title: "Error", description: "Could not query engagements"});
            setLoading(false);
        });

        return () => unsub();
    }, [toast]);
    
    const handleSubmitForBilling = async (engagementsToSubmit: Engagement[]) => {
        const idsToProcess = engagementsToSubmit.map(e => e.id);
        if (idsToProcess.length === 0) {
            toast({ title: "No Engagements", description: "There are no engagements to submit."});
            return;
        }

        setProcessingIds(prev => [...prev, ...idsToProcess]);
        if (engagementsToSubmit.length === engagements.length) {
            setIsSubmittingAll(true);
        }

        const batch = writeBatch(db);

        engagementsToSubmit.forEach(engagement => {
            const client = clients.get(engagement.clientId);
            if (client) {
                const engagementRef = doc(db, "engagements", engagement.id);
                batch.update(engagementRef, {
                    billStatus: "To Bill",
                    billSubmissionDate: new Date().toISOString()
                });
                
                const pendingInvoiceRef = doc(collection(db, "pendingInvoices"));
                batch.set(pendingInvoiceRef, {
                    id: pendingInvoiceRef.id,
                    engagementId: engagement.id,
                    clientId: engagement.clientId,
                    assignedTo: engagement.assignedTo,
                    reportedTo: engagement.reportedTo,
                    partnerId: client.partnerId
                });
            }
        });

        try {
            await batch.commit();
            toast({ title: "Success", description: `${engagementsToSubmit.length} engagement(s) submitted for billing.` });
        } catch (error) {
            console.error("Error submitting for billing:", error);
            toast({ title: "Error", description: "Failed to submit engagements for billing.", variant: "destructive"});
        } finally {
            setProcessingIds(prev => prev.filter(id => !idsToProcess.includes(id)));
            setIsSubmittingAll(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <Button variant="outline" size="sm" onClick={() => router.push('/reports')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Reports
            </Button>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                         <div>
                            <CardTitle>Unbilled Engagements</CardTitle>
                            <CardDescription>
                                Engagements marked as "Completed" but not yet submitted for billing.
                            </CardDescription>
                        </div>
                        {engagements.length > 0 && (
                            <Button onClick={() => handleSubmitForBilling(engagements)} disabled={isSubmittingAll}>
                                {isSubmittingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Submit All for Billing
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Client</TableHead>
                                <TableHead>Engagement</TableHead>
                                <TableHead>Completion Date</TableHead>
                                <TableHead>Submit</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {engagements.length > 0 ? (
                                engagements.map(eng => {
                                    const client = clients.get(eng.clientId);
                                    const isProcessing = processingIds.includes(eng.id);
                                    return (
                                    <TableRow key={eng.id}>
                                        <TableCell className="font-medium">{client?.Name || "..."}</TableCell>
                                        <TableCell>{eng.remarks}</TableCell>
                                        <TableCell>{format(parseISO(eng.dueDate), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSubmitForBilling([eng])}
                                                disabled={isProcessing}
                                            >
                                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                                Submit for Billing
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="link" size="sm" asChild>
                                                <Link href={`/workflow/${eng.id}`}>Go to Workflow</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )})
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No unbilled engagements found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
