
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, parseISO } from "date-fns";
import type { Engagement, Client, EngagementType, Employee } from "@/lib/data";
import Link from "next/link";
import { Badge } from "../ui/badge";

interface TodoDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  engagements?: Engagement[];
  clients?: Client[];
}

export function TodoDetailsDialog({ isOpen, onClose, title, engagements, clients: incompleteClients }: TodoDetailsDialogProps) {
    const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
    const [engagementTypes, setEngagementTypes] = React.useState<Map<string, EngagementType>>(new Map());
    const [employees, setEmployees] = React.useState<Map<string, Employee>>(new Map());

    React.useEffect(() => {
        if (!isOpen) return;

        const clientUnsub = onSnapshot(collection(db, "clients"), (snapshot) => {
            setClients(new Map(snapshot.docs.map(doc => [doc.id, doc.data() as Client])));
        });
        const engagementTypeUnsub = onSnapshot(collection(db, "engagementTypes"), (snapshot) => {
            setEngagementTypes(new Map(snapshot.docs.map(doc => [doc.id, doc.data() as EngagementType])));
        });
        const employeeUnsub = onSnapshot(collection(db, "employees"), (snapshot) => {
            setEmployees(new Map(snapshot.docs.map(doc => [doc.id, doc.data() as Employee])));
        });

        return () => {
            clientUnsub();
            engagementTypeUnsub();
            employeeUnsub();
        }
    }, [isOpen]);
    
    const renderEngagementContent = () => (
         <Table>
            <TableHeader className="sticky top-0 bg-muted">
                <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reporter</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {engagements && engagements.length > 0 ? engagements.slice(0, 10).map(engagement => {
                    const client = clients.get(engagement.clientId);
                    const engagementType = engagementTypes.get(engagement.type);
                    const reporter = employees.get(engagement.reportedTo);
                    return (
                        <TableRow key={engagement.id}>
                            <TableCell>{client?.Name || 'Loading...'}</TableCell>
                            <TableCell>{engagement.remarks || engagementType?.name || 'Loading...'}</TableCell>
                            <TableCell>{format(parseISO(engagement.dueDate), 'dd MMM yyyy')}</TableCell>
                            <TableCell>{engagement.status}</TableCell>
                            <TableCell>{reporter?.name || 'Not Assigned'}</TableCell>
                        </TableRow>
                    )
                }) : (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">No engagements to display.</TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );

    const renderClientContent = () => (
         <Table>
            <TableHeader className="sticky top-0 bg-muted">
                <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>PAN</TableHead>
                    <TableHead>Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {incompleteClients && incompleteClients.length > 0 ? incompleteClients.map(client => {
                    return (
                        <TableRow key={client.id}>
                            <TableCell>{client.name}</TableCell>
                            <TableCell>{client.mailId}</TableCell>
                            <TableCell>{client.mobileNumber}</TableCell>
                            <TableCell>{client.pan || "N/A"}</TableCell>
                             <TableCell>
                                <Button variant="link" asChild size="sm">
                                    <Link href="/clients">Go to Client Manager</Link>
                                </Button>
                             </TableCell>
                        </TableRow>
                    )
                }) : (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24">No clients to display.</TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Here is a list of items that require your attention.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-hidden border rounded-md">
                    <ScrollArea className="h-full">
                       {engagements && renderEngagementContent()}
                       {incompleteClients && renderClientContent()}
                        <ScrollBar orientation="vertical" />
                         <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    )
}
