
"use client";

import * as React from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Communication, Employee } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Inbox, AlertTriangle, FileText, ListChecks, Link as LinkIcon, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// This is sample data to demonstrate the UI.
// In a real application, this would be populated by the email fetching service.
const sampleCommunications: Communication[] = [
    {
        id: "comm1",
        from: "contact@innovate.com",
        subject: "Re: Required Documents for ITR Filing FY 2023-24",
        body: "Hello Team,\n\nPlease find attached all the required documents for our ITR filing. Let me know if you need anything else.\n\nThanks,\nVijay Kumar",
        receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        clientId: "client1_id_placeholder",
        clientName: "Innovate Inc.",
        summary: "Vijay Kumar from Innovate Inc. has submitted all the necessary documents for the ITR filing for fiscal year 2023-24.",
        category: "Document Submission",
        actionItems: ["Verify all submitted documents.", "Update engagement status to 'In Process'."],
        visibleTo: ["S001", "S002", "S003"]
    },
    {
        id: "comm2",
        from: "john.doe@example.com",
        subject: "Urgent Query: Tax Implications of Property Sale",
        body: "Hi,\n\nI need some urgent advice. I am planning to sell a property and need to understand the tax implications. Can we schedule a call for tomorrow?\n\nBest,\nJohn Doe",
        receivedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        clientId: "client2_id_placeholder",
        clientName: "John Doe",
        summary: "John Doe has an urgent query regarding the tax implications of a property sale and has requested a call for tomorrow.",
        category: "Urgent",
        actionItems: ["Contact John Doe to schedule a call.", "Prepare preliminary notes on capital gains tax for property sales."],
        visibleTo: ["S006", "S003"]
    },
    {
        id: "comm3",
        from: "accounts@greenfuture.com",
        subject: "Thank You!",
        body: "Hi Priya,\n\nJust wanted to say thank you for your prompt assistance with our GST filing this month. We really appreciate your efficiency.\n\nRegards,\nEmily",
        receivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        clientId: "client3_id_placeholder",
        clientName: "GreenFuture LLP",
        summary: "Emily from GreenFuture LLP sent a note of appreciation for the prompt assistance with their recent GST filing.",
        category: "Appreciation",
        actionItems: [],
        visibleTo: ["S001", "S002", "S004"]
    }
];

export default function InboxPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [communications, setCommunications] = React.useState<Communication[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedComm, setSelectedComm] = React.useState<Communication | null>(null);

    React.useEffect(() => {
        if (!user) return;
        setLoading(true);

        // In a real implementation, you would fetch from Firestore like this:
        /*
        const q = query(
            collection(db, "communications"),
            where("visibleTo", "array-contains", user.uid), // Assuming user.uid is the employee ID
            orderBy("receivedAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const commsData = snapshot.docs.map(doc => doc.data() as Communication);
            setCommunications(commsData);
            if (commsData.length > 0) {
                setSelectedComm(commsData[0]);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching communications:", error);
            toast({ title: "Error", description: "Could not fetch inbox data.", variant: "destructive" });
            setLoading(false);
        });

        return () => unsubscribe();
        */

        // For now, using sample data
        setCommunications(sampleCommunications);
        setSelectedComm(sampleCommunications[0] || null);
        setLoading(false);

    }, [user, toast]);

    if (loading || authLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0 mb-4">
                <h2 className="text-3xl font-bold tracking-tight font-headline">Inbox</h2>
                <p className="text-muted-foreground">
                    Client emails processed and summarized by your AI assistant.
                </p>
            </div>
            {communications.length === 0 ? (
                <div className="flex-grow flex items-center justify-center">
                    <Card className="text-center p-8">
                        <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-4 text-lg font-medium">All caught up!</h3>
                        <p className="mt-2 text-sm text-muted-foreground">There are no new communications for you.</p>
                    </Card>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow overflow-hidden">
                    <Card className="md:col-span-1 flex flex-col">
                        <CardHeader>
                            <CardTitle>All Communications</CardTitle>
                        </CardHeader>
                        <ScrollArea className="flex-grow">
                        <CardContent className="space-y-2">
                           {communications.map(comm => (
                               <button 
                                key={comm.id} 
                                className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedComm?.id === comm.id ? 'bg-muted border-primary' : 'hover:bg-muted/50'}`}
                                onClick={() => setSelectedComm(comm)}
                                >
                                   <div className="flex justify-between items-start">
                                        <p className="font-semibold text-sm">{comm.clientName}</p>
                                        <p className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(comm.receivedAt), { addSuffix: true })}</p>
                                   </div>
                                    <p className="text-xs text-muted-foreground truncate">{comm.subject}</p>
                               </button>
                           ))}
                        </CardContent>
                        </ScrollArea>
                    </Card>
                    {selectedComm && (
                        <Card className="md:col-span-2 flex flex-col">
                           <ScrollArea className="h-full">
                           <CardHeader className="flex flex-row items-start justify-between">
                                <div>
                                    <Badge variant={selectedComm.category === 'Urgent' ? 'destructive' : 'secondary'}>{selectedComm.category}</Badge>
                                    <CardTitle className="mt-2">{selectedComm.subject}</CardTitle>
                                    <CardDescription>From: {selectedComm.from} | To: You</CardDescription>
                                </div>
                                {selectedComm.clientId && (
                                    <Button asChild variant="outline">
                                        <Link href={`/workspace/${selectedComm.clientId}`}>
                                            <LinkIcon className="mr-2" />
                                            Client Workspace
                                        </Link>
                                    </Button>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <h4 className="flex items-center text-lg font-semibold mb-2"><FileText className="mr-2"/> AI Summary</h4>
                                    <p className="text-sm bg-muted p-4 rounded-md">{selectedComm.summary}</p>
                                </div>
                                 {selectedComm.actionItems && selectedComm.actionItems.length > 0 && (
                                     <div>
                                        <h4 className="flex items-center text-lg font-semibold mb-2"><ListChecks className="mr-2"/> Action Items</h4>
                                        <ul className="list-disc list-inside space-y-1 bg-muted p-4 rounded-md text-sm">
                                            {selectedComm.actionItems.map((item, index) => <li key={index}>{item}</li>)}
                                        </ul>
                                    </div>
                                 )}
                                  <div>
                                    <h4 className="flex items-center text-lg font-semibold mb-2"><Users className="mr-2"/> Visible To</h4>
                                     <p className="text-sm text-muted-foreground">The AI has determined this email is relevant to the partners and employees assigned to this client.</p>
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold mb-2">Original Message</h4>
                                    <div className="text-sm bg-muted p-4 rounded-md whitespace-pre-wrap font-mono">{selectedComm.body}</div>
                                </div>
                            </CardContent>
                           </ScrollArea>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
