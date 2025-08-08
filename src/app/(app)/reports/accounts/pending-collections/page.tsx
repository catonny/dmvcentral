
"use client";

import * as React from "react";
import { collection, query, onSnapshot, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Engagement, Client, BillStatus, EngagementType, Employee } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

export default function PendingCollectionsPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [engagements, setEngagements] = React.useState<Engagement[]>([]);
    const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
    const [loading, setLoading] = React.useState(true);
    const [processingId, setProcessingId] = React.useState<string | null>(null);

    React.useEffect(() => {
        const fetchClients = async () => {
            const clientSnapshot = await getDocs(collection(db, "clients"));
            setClients(new Map(clientSnapshot.docs.map(doc => [doc.id, { id: doc.id, ...doc.data() } as Client])));
        };
        fetchClients();

        const q = query(collection(db, "engagements"), where("billStatus", "==", "Pending Collection"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedEngagements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
            setEngagements(fetchedEngagements.sort((a,b) => new Date(a.billSubmissionDate!).getTime() - new Date(b.billSubmissionDate!).getTime()));
            setLoading(false);
        }, (error) => {
            console.error("Error fetching pending collections:", error);
            toast({ title: "Error", description: "Could not fetch collections data.", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [toast]);

    const handleMarkAsCollected = async (engagementId: string) => {
        setProcessingId(engagementId);
        try {
            const engagementRef = doc(db, "engagements", engagementId);
            await updateDoc(engagementRef, { billStatus: "Collected" });
            toast({ title: "Success!", description: "Engagement marked as collected." });
        } catch (error) {
            console.error("Error marking as collected:", error);
            toast({ title: "Error", description: "Could not update engagement status.", variant: "destructive" });
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <Button variant="outline" size="sm" onClick={() => router.push('/reports/accounts')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Accounts Reports
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>Pending Collections Report</CardTitle>
                    <CardDescription>Engagements that have been billed and are awaiting payment.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="w-full whitespace-nowrap">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Engagement</TableHead>
                                    <TableHead>Billed Date</TableHead>
                                    <TableHead>Days Pending</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell>
                                    </TableRow>
                                ) : engagements.length > 0 ? (
                                    engagements.map(engagement => {
                                        const client = clients.get(engagement.clientId);
                                        const daysPending = engagement.billSubmissionDate ? differenceInDays(new Date(), parseISO(engagement.billSubmissionDate)) : 0;
                                        const isProcessing = processingId === engagement.id;

                                        return (
                                            <TableRow key={engagement.id}>
                                                <TableCell>{client?.name || 'Unknown Client'}</TableCell>
                                                <TableCell>{engagement.remarks}</TableCell>
                                                <TableCell>{engagement.billSubmissionDate ? format(parseISO(engagement.billSubmissionDate), "dd MMM, yyyy") : 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={daysPending > 30 ? "destructive" : "secondary"}>{daysPending} days</Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">₹{engagement.fees?.toLocaleString('en-IN') || '0.00'}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleMarkAsCollected(engagement.id)}
                                                        disabled={isProcessing}
                                                    >
                                                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                                        Mark as Collected
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center h-24">No pending collections found. Great job!</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
