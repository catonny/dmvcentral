

"use client";

import * as React from "react";
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, writeBatch, getDocs, where } from "firebase/firestore";
import type { Client, Employee, Department, Engagement } from "@/lib/data";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/dashboard/data-table";
import { getColumns } from "@/components/dashboard/columns";
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
import { useAuth } from "@/hooks/use-auth";
import { BulkEmailDialog } from "./bulk-email-dialog";

interface ClientManagerProps {
    clients: Client[];
    isPartner: boolean;
}

export function ClientManager({ clients, isPartner }: ClientManagerProps) {
  const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
  const [allClients, setAllClients] = React.useState<Client[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = React.useState(false);
  const [isConfirmPartnerChangeOpen, setIsConfirmPartnerChangeOpen] = React.useState(false);
  const [isBulkEmailDialogOpen, setIsBulkEmailDialogOpen] = React.useState(false);
  const [selectedRowsForEmail, setSelectedRowsForEmail] = React.useState<Client[]>([]);

  const [partnerChangeData, setPartnerChangeData] = React.useState<{ oldPartnerId: string, newPartnerId: string, clientId: string } | null>(null);

  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentUserEmployee, setCurrentUserEmployee] = React.useState<Employee | null>(null);

  React.useEffect(() => {
    if (user) {
        const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
        getDocs(employeeQuery).then(snapshot => {
            if (!snapshot.empty) {
                setCurrentUserEmployee({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Employee);
            }
        });
    }
  }, [user]);

  React.useEffect(() => {
    // These are master data, so we can fetch them once.
    const fetchMasterData = async () => {
        try {
            const employeeQuery = query(collection(db, "employees"));
            const deptsQuery = query(collection(db, "departments"));
            const clientsQuery = query(collection(db, "clients"));


            const [employeeSnapshot, deptsSnapshot, clientsSnapshot] = await Promise.all([
                getDocs(employeeQuery),
                getDocs(deptsQuery),
                getDocs(clientsQuery)
            ]);

            const employeeData = employeeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
            setAllEmployees(employeeData);

            const deptsData = deptsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
            setDepartments(deptsData);
            
            const clientsData = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            setAllClients(clientsData);


        } catch (error) {
            console.error("Error fetching master data for Client Manager:", error);
            toast({ title: "Error", description: `Failed to fetch master data.`, variant: "destructive" });
        }
    }
    fetchMasterData();
  }, [toast]);


  const handleUpdateClientField = async (clientId: string, field: keyof Client, value: any) => {
      if (!clientId || !field) return;
      const clientRef = doc(db, "clients", clientId);
      try {
          await updateDoc(clientRef, { [field]: value });
          toast({
              title: "Update Successful",
              description: `Client's ${String(field)} has been updated.`,
          });
      } catch (error) {
          console.error("Error updating client field:", error);
          toast({
              title: "Update Failed",
              description: `Could not update client's ${String(field)}.`,
              variant: "destructive",
          });
      }
  };
  
  const handleOpenEditSheet = (client: Client | null) => {
      setSelectedClient(client);
      setIsSheetOpen(true);
  };

  const handleCloseEditSheet = () => {
      setIsSheetOpen(false);
      setSelectedClient(null);
  };

  const handleSaveClient = async (clientData: Partial<Client>) => {
    try {
        if (selectedClient?.id) { // Editing existing client
            const oldPartnerId = selectedClient.partnerId;
            const newPartnerId = clientData.partnerId;

            if (newPartnerId && oldPartnerId !== newPartnerId) {
                // Partner has changed, show confirmation dialog
                setPartnerChangeData({ oldPartnerId, newPartnerId, clientId: selectedClient.id });
                setIsConfirmPartnerChangeOpen(true);
            }
            
            const clientRef = doc(db, "clients", selectedClient.id);
            await updateDoc(clientRef, {...clientData, lastUpdated: new Date().toISOString() });
            toast({ title: "Success", description: "Client updated successfully." });
            
        } else { // Adding new client
            await addDoc(collection(db, "clients"), {...clientData, lastUpdated: new Date().toISOString()});
            toast({ title: "Success", description: "New client added successfully." });
        }
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
    } catch (error) {
        console.error("Error deleting client:", error);
        toast({ title: "Error", description: "Failed to delete client.", variant: "destructive" });
    } finally {
        setIsConfirmDeleteDialogOpen(false);
        setSelectedClient(null);
    }
  };
  
  const handleConfirmPartnerChange = async (shouldUpdateEngagements: boolean) => {
    if (!partnerChangeData) return;
    
    if (shouldUpdateEngagements) {
        const { oldPartnerId, newPartnerId, clientId } = partnerChangeData;
        
        const oldPartner = allEmployees.find(e => e.id === oldPartnerId);
        const newPartner = allEmployees.find(e => e.id === newPartnerId);
        
        if (!oldPartner || !newPartner) {
            toast({ title: "Error", description: "Could not find partner profiles.", variant: "destructive" });
            return;
        }

        try {
            const batch = writeBatch(db);
            const activeStatuses: Engagement['status'][] = ["Pending", "Awaiting Documents", "In Process", "Partner Review"];
            const engagementsQuery = query(
                collection(db, 'engagements'), 
                where('clientId', '==', clientId),
                where('status', 'in', activeStatuses),
                where('reportedTo', '==', oldPartner.id)
            );
            const engagementsSnapshot = await getDocs(engagementsQuery);
            
            let updatedCount = 0;
            engagementsSnapshot.forEach(doc => {
                const engagementRef = doc.ref;
                batch.update(engagementRef, { reportedTo: newPartner.id });
                updatedCount++;
            });
            
            await batch.commit();
            if (updatedCount > 0) {
                toast({ title: "Success", description: `${updatedCount} active engagement(s) have been reassigned to ${newPartner.name}.` });
            } else {
                toast({ title: "No Changes", description: "No active engagements were assigned to the old partner." });
            }

        } catch (error) {
             console.error("Error updating engagements:", error);
            toast({ title: "Error", description: "Failed to update engagements.", variant: "destructive" });
        }
    }
    
    setPartnerChangeData(null);
    setIsConfirmPartnerChangeOpen(false);
  }

  const handleBulkEmail = (selectedClients: Client[]) => {
      setSelectedRowsForEmail(selectedClients);
      setIsBulkEmailDialogOpen(true);
  }

  const partners = React.useMemo(() => {
    const partnerDept = departments.find(d => d.name.toLowerCase() === 'partner');
    if (!partnerDept) return [];
    return allEmployees.filter(s => Array.isArray(s.role) && s.role.includes(partnerDept.name));
  }, [allEmployees, departments]);

  const columns = React.useMemo(() => getColumns(handleOpenEditSheet, handleConfirmDeleteClient, handleUpdateClientField, partners, allClients, allEmployees), [partners, allClients, allEmployees]);

  return (
    <>
      <DataTable 
          columns={columns} 
          data={clients}
          openEditSheet={handleOpenEditSheet}
          onBulkEmail={handleBulkEmail}
      />
      <EditClientSheet
        client={selectedClient}
        isOpen={isSheetOpen}
        onClose={handleCloseEditSheet}
        onSave={handleSaveClient}
      />
       <BulkEmailDialog
        isOpen={isBulkEmailDialogOpen}
        onClose={() => setIsBulkEmailDialogOpen(false)}
        selectedClients={selectedRowsForEmail}
        currentUser={currentUserEmployee}
      />
      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the client{" "}
              <strong>{selectedClient?.Name}</strong> and all of their associated engagements.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedClient(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClient}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
       <AlertDialog open={isConfirmPartnerChangeOpen} onOpenChange={setIsConfirmPartnerChangeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Partner Changed</AlertDialogTitle>
            <AlertDialogDescription>
              The partner for this client has been changed. Do you want to reassign the active engagements currently reported to <strong>{allEmployees.find(e => e.id === partnerChangeData?.oldPartnerId)?.name}</strong> to the new partner, <strong>{allEmployees.find(e => e.id === partnerChangeData?.newPartnerId)?.name}</strong>?
              <br/><br/>
              <small>Engagements reported to a Manager will not be affected.</small>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleConfirmPartnerChange(false)}>No, Don't Update</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmPartnerChange(true)}>Yes, Update Engagements</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
