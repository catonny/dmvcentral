
"use client";

import * as React from "react";
import { collection, query, onSnapshot, getDocs, doc, updateDoc, where, writeBatch, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Engagement, Client, BillStatus, EngagementType, Employee } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, differenceInDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ArrowLeft, CheckCircle, Loader2, SendToBack } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

const EditableFeeCell = ({
  engagementId,
  initialValue,
  onUpdate,
}: {
  engagementId: string;
  initialValue: number;
  onUpdate: (engagementId: string, newValue: number) => void;
}) => {
  const [value, setValue] = React.useState(initialValue);
  const debouncedValue = useDebounce(value, 500);

  React.useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  React.useEffect(() => {
    if (debouncedValue !== initialValue) {
      onUpdate(engagementId, debouncedValue);
    }
  }, [debouncedValue, initialValue, engagementId, onUpdate]);

  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => setValue(Number(e.target.value) || 0)}
      className="w-32 text-right font-mono"
    />
  );
};


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
    
     const handleUpdateFee = async (engagementId: string, newFee: number) => {
        const engagementRef = doc(db, "engagements", engagementId);
        try {
            await updateDoc(engagementRef, { fees: newFee });
            toast({ title: "Success", description: "Engagement fee updated successfully." });
        } catch (error) {
            console.error("Error updating fee:", error);
            toast({ title: "Error", description: "Could not update the fee.", variant: "destructive" });
        }
    };

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
    
    const handleSendBackToBilling = async (engagement: Engagement) => {
        setProcessingId(engagement.id);
        const client = clients.get(engagement.clientId);
        if (!client) {
            toast({ title: "Error", description: "Client data not found for this engagement.", variant: "destructive" });
            setProcessingId(null);
            return;
        }

        try {
            const batch = writeBatch(db);
            
            // 1. Update engagement status
            const engagementRef = doc(db, "engagements", engagement.id);
            batch.update(engagementRef, { billStatus: "To Bill" });

            // 2. Re-create the pendingInvoices document
            const pendingInvoiceRef = doc(collection(db, "pendingInvoices"));
            batch.set(pendingInvoiceRef, {
                id: pendingInvoiceRef.id,
                engagementId: engagement.id,
                clientId: engagement.clientId,
                assignedTo: engagement.assignedTo,
                reportedTo: engagement.reportedTo,
                partnerId: client.partnerId,
            });

            await batch.commit();
            toast({ title: "Success!", description: "Engagement sent back to billing dashboard." });

        } catch (error) {
            console.error("Error sending back to billing:", error);
            toast({ title: "Error", description: "Could not send engagement back to billing.", variant: "destructive" });
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
                                    <TableHead className="text-right">Amount (INR)</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
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
                                                <TableCell className="text-right">
                                                    <EditableFeeCell
                                                        engagementId={engagement.id}
                                                        initialValue={engagement.fees || 0}
                                                        onUpdate={handleUpdateFee}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleSendBackToBilling(engagement)}
                                                        disabled={isProcessing}
                                                    >
                                                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SendToBack className="mr-2 h-4 w-4" />}
                                                        Back to Billing
                                                    </Button>
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
