
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Client } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function IncompleteClientsReportPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = React.useState(true);
    const [clients, setClients] = React.useState<Client[]>([]);

    React.useEffect(() => {
        const panQuery = query(collection(db, "clients"), where("pan", "==", "PANNOTAVLBL"));
        const emailQuery = query(collection(db, "clients"), where("mailId", "==", "unassigned"));
        const mobileQuery = query(collection(db, "clients"), where("mobileNumber", "==", "1111111111"));
        
        const unsubs: (()=>void)[] = [];
        const clientMap = new Map<string, Client>();

        const processSnapshot = (snapshot: any) => {
            snapshot.docs.forEach((doc: any) => {
                if (!clientMap.has(doc.id)) {
                    clientMap.set(doc.id, { id: doc.id, ...doc.data() });
                }
            });
            setClients(Array.from(clientMap.values()));
        };
        
        unsubs.push(onSnapshot(panQuery, processSnapshot, (err) => toast({variant: "destructive", title: "Error", description: "Could not query PANs"})));
        unsubs.push(onSnapshot(emailQuery, processSnapshot, (err) => toast({variant: "destructive", title: "Error", description: "Could not query emails"})));
        unsubs.push(onSnapshot(mobileQuery, processSnapshot, (err) => toast({variant: "destructive", title: "Error", description: "Could not query mobiles"})));

        setLoading(false);
        return () => unsubs.forEach(unsub => unsub());

    }, [toast]);

    const getMissingFields = (client: Client) => {
        const missing = [];
        if (client.pan === 'PANNOTAVLBL') missing.push('PAN');
        if (client.mailId === 'unassigned') missing.push('Email');
        if (client.mobileNumber === '1111111111') missing.push('Mobile');
        return missing;
    }

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
                    <CardTitle>Clients with Incomplete Data</CardTitle>
                    <CardDescription>
                        The following clients have missing mandatory information. Please update them in the Client Manager.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Client Name</TableHead>
                                <TableHead>Missing Fields</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {clients.length > 0 ? (
                                clients.map(client => (
                                    <TableRow key={client.id}>
                                        <TableCell className="font-medium">{client.name}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                {getMissingFields(client).map(field => (
                                                    <Badge key={field} variant="destructive">{field}</Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="link" size="sm" asChild>
                                                <Link href="/clients">Go to Client Manager</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        No clients with incomplete data found. Great job!
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
