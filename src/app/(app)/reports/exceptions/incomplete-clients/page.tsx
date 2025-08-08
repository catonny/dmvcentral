
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, doc, updateDoc, writeBatch, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Client, Engagement } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditClientSheet } from "@/components/dashboard/edit-client-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function IncompleteClientsReportPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = React.useState(true);
    const [clients, setClients] = React.useState<Client[]>([]);
    
    // State for edit sheet
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
    const [allClients, setAllClients] = React.useState<Client[]>([]);
    const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = React.useState(false);


    React.useEffect(() => {
        // Fetch all clients for the edit sheet's "link clients" functionality
        const allClientsUnsub = onSnapshot(collection(db, "clients"), (snapshot) => {
            setAllClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        });

        // Fetch only incomplete clients for the table
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
        return () => {
            unsubs.forEach(unsub => unsub());
            allClientsUnsub();
        }

    }, [toast]);
    
    const getMissingFields = (client: Client) => {
        const missing = [];
        if (client.pan === 'PANNOTAVLBL') missing.push('PAN');
        if (client.mailId === 'unassigned') missing.push('Email');
        if (client.mobileNumber === '1111111111') missing.push('Mobile');
        return missing;
    };
    
    const handleOpenEditSheet = (client: Client) => {
        setSelectedClient(client);
        setIsSheetOpen(true);
    };

    const handleCloseEditSheet = () => {
        setIsSheetOpen(false);
        setSelectedClient(null);
    };

    const handleSaveClient = async (clientData: Partial<Client>) => {
        if (!selectedClient?.id) return;
        try {
            const clientRef = doc(db, "clients", selectedClient.id);
            await updateDoc(clientRef, { ...clientData, lastUpdated: new Date().toISOString() });
            toast({ title: "Success", description: "Client updated successfully." });
            handleCloseEditSheet();
        } catch (error) {
            console.error("Error saving client:", error);
            toast({ title: "Error", description: "Failed to save client data.", variant: "destructive" });
        }
    };
    
    const handleConfirmDeleteClient = (client: Client) => {
        setSelectedClient(client);
        setIsConfirmDeleteDialogOpen(true);
    };

    const handleDeleteClient = async () => {
        if (!selectedClient) return;
        try {
            const batch = writeBatch(db);
            const clientRef = doc(db, "clients", selectedClient.id);
            batch.delete(clientRef);
            
            const engagementsQuery = query(collection(db, 'engagements'), where('clientId', '==', selectedClient.id));
            const engagementsSnapshot = await getDocs(engagementsQuery);
            engagementsSnapshot.forEach(doc => batch.delete(doc.ref));
    
            await batch.commit();
            toast({ title: "Success", description: `Client ${selectedClient.Name} and all associated engagements have been deleted.` });
            handleCloseEditSheet();
        } catch (error) {
            console.error("Error deleting client:", error);
            toast({ title: "Error", description: "Failed to delete client.", variant: "destructive" });
        } finally {
            setIsConfirmDeleteDialogOpen(false);
            setSelectedClient(null);
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
                    <CardTitle>Clients with Incomplete Data</CardTitle>
                    <CardDescription>
                        The following clients have missing mandatory information. Please update them.
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
                                            <Button variant="link" size="sm" onClick={() => handleOpenEditSheet(client)}>
                                                Edit Client
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

            <EditClientSheet
                client={selectedClient}
                isOpen={isSheetOpen}
                onClose={handleCloseEditSheet}
                onSave={handleSaveClient}
                onDelete={handleConfirmDeleteClient}
                allClients={allClients}
            />

            <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the client{" "}
                            <strong>{selectedClient?.name}</strong> and all of their associated engagements.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setSelectedClient(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteClient} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

