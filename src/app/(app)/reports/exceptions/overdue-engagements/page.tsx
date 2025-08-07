
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs } from "firebase/firestore";
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
import { Badge } from "@/components/ui/badge";

export default function OverdueEngagementsReportPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = React.useState(true);
    const [engagements, setEngagements] = React.useState<Engagement[]>([]);
    const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
    const [employees, setEmployees] = React.useState<Map<string, Employee>>(new Map());

    React.useEffect(() => {
        setLoading(true);

        const fetchStaticData = async () => {
             const [clientsSnapshot, employeesSnapshot] = await Promise.all([
                getDocs(collection(db, "clients")),
                getDocs(collection(db, "employees")),
            ]);
            setClients(new Map(clientsSnapshot.docs.map(doc => [doc.id, doc.data() as Client])));
            setEmployees(new Map(employeesSnapshot.docs.map(doc => [doc.id, doc.data() as Employee])));
        }
        fetchStaticData();
        
        const q = query(collection(db, "engagements"), 
            where("dueDate", "<", new Date().toISOString()),
            where("status", "in", ["Pending", "Awaiting Documents", "In Process", "Partner Review", "On Hold"])
        );
        
        const unsub = onSnapshot(q, (snapshot) => {
            setEngagements(snapshot.docs.map(doc => doc.data() as Engagement));
            setLoading(false);
        }, (err) => {
            toast({variant: "destructive", title: "Error", description: "Could not query engagements"});
            setLoading(false);
        });

        return () => unsub();
    }, [toast]);

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
                    <CardTitle>Overdue Engagements</CardTitle>
                    <CardDescription>
                        Engagements that have passed their due date but are not yet completed.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Client</TableHead>
                                <TableHead>Engagement</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Assigned To</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {engagements.length > 0 ? (
                                engagements.map(eng => {
                                    const client = clients.get(eng.clientId);
                                    const assignedEmployees = eng.assignedTo.map(id => employees.get(id)?.name).filter(Boolean).join(", ");
                                    return (
                                    <TableRow key={eng.id}>
                                        <TableCell className="font-medium">{client?.Name || "..."}</TableCell>
                                        <TableCell>{eng.remarks}</TableCell>
                                        <TableCell className="text-destructive font-semibold">{format(parseISO(eng.dueDate), 'dd MMM yyyy')}</TableCell>
                                        <TableCell><Badge variant="outline">{eng.status}</Badge></TableCell>
                                        <TableCell>{assignedEmployees || "Unassigned"}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="link" size="sm" asChild>
                                                <Link href={`/workflow/${eng.id}`}>Go to Workflow</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )})
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        No overdue engagements found. Well done!
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
