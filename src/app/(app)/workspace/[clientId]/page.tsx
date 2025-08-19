

"use client";

import * as React from "react";
import { getDoc, collection, onSnapshot, query, where, writeBatch, updateDoc, addDoc, serverTimestamp, orderBy, getDocs, doc, setDoc } from "firebase/firestore";
import type { Client, Engagement, Employee, EngagementType, Task, TaskStatus } from "@/lib/data";
import { db, logActivity, notify } from "@/lib/firebase";
import { notFound, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PastEngagementsDialog } from "@/components/workspace/past-engagements-dialog";
import { EngagementHistoryDialog } from "@/components/workspace/engagement-history-dialog";
import { EditableDueDate } from "@/components/workspace/editable-due-date";
import { EditableStatus } from "@/components/workspace/editable-status";
import { EditableAssignees } from "@/components/workspace/editable-assignees";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EngagementNotes } from "@/components/workspace/engagement-notes";
import { CheckSquare, MessageSquare, Send, Book, FileText, StickyNote, Edit, Check, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EditEngagementSheet } from "@/components/reports/edit-engagement-sheet";
import { LogTimeDialog } from "@/components/workspace/log-time-dialog";
import { ClientNotes } from "@/components/workspace/client-notes";


export default function ClientWorkspacePage() {
  const params = useParams();
  const { user } = useAuth();
  const clientId = params.clientId as string;
  const [client, setClient] = React.useState<Client | null>(null);
  const [engagements, setEngagements] = React.useState<Engagement[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [allClients, setAllClients] = React.useState<Client[]>([]);
  const [currentUserEmployee, setCurrentUserEmployee] = React.useState<Employee | null>(null);
  const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isPastEngagementsOpen, setIsPastEngagementsOpen] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedEngagement, setSelectedEngagement] = React.useState<Engagement | null>(null);
  const { toast } = useToast();
  
  React.useEffect(() => {
    if (!clientId) return;

    setLoading(true);

    const handleError = (error: Error, type: string) => {
      console.error(`Error fetching ${type}: `, error);
      toast({ title: "Error", description: `Failed to load ${type} data.`, variant: "destructive" });
    };
    
    if (user) {
        getDocs(query(collection(db, "employees"), where("email", "==", user.email)))
            .then(snap => {
                if (!snap.empty) setCurrentUserEmployee(snap.docs[0].data() as Employee);
            });
    }

    const clientUnsub = onSnapshot(doc(db, "clients", clientId), (clientDoc) => {
      if (clientDoc.exists()) {
        setClient({ id: clientDoc.id, ...clientDoc.data() } as Client);
      } else {
        setClient(null);
      }
      setLoading(false);
    }, (error) => handleError(error, 'client details'));

    const fetchStaticData = async () => {
        try {
            const [employeeSnapshot, engagementTypesSnapshot, allClientsSnapshot] = await Promise.all([
                getDocs(query(collection(db, "employees"))),
                getDocs(query(collection(db, "engagementTypes"))),
                getDocs(query(collection(db, "clients"))),
            ]);
            setEmployees(employeeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
            setEngagementTypes(engagementTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EngagementType)));
            setAllClients(allClientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        } catch (error) {
            handleError(error as Error, 'master');
        }
    };
    fetchStaticData();

    const activeStatuses: EngagementStatus[] = ["Pending", "Awaiting Documents", "In Process", "Partner Review", "On Hold"];
    const engagementsQuery = query(
        collection(db, "engagements"), 
        where("clientId", "==", clientId),
        where("status", "in", activeStatuses)
    );

    const engagementsUnsub = onSnapshot(engagementsQuery, (snapshot) => {
      const fetchedEngagements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement))
        .sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setEngagements(fetchedEngagements);
    }, (error) => handleError(error, 'engagements'));
    
    const tasksQuery = query(collection(db, "tasks"), where("clientId", "==", clientId));
    const tasksUnsub = onSnapshot(tasksQuery, (snapshot) => {
        const tasksData = snapshot.docs.map(doc => doc.data() as Task).sort((a,b) => a.order - b.order);
        setTasks(tasksData);
    }, (error) => {
         console.error("Error fetching tasks:", error);
    });

    return () => {
      clientUnsub();
      engagementsUnsub();
      tasksUnsub();
    };
  }, [clientId, toast, user]);
  
  const updateEngagementField = async (engagementId: string, field: keyof Engagement, value: any, successMessage?: string) => {
        const engagementRef = doc(db, "engagements", engagementId);
        try {
            await updateDoc(engagementRef, { [field]: value });
            if (successMessage) {
                toast({
                    title: "Success",
                    description: successMessage,
                });
            }
        } catch (error) {
            console.error(`Error updating ${field}:`, error);
            toast({
                title: "Error",
                description: `Failed to update the ${field}.`,
                variant: "destructive",
            });
        }
    };
    
    const handleDueDateChange = (engagementId: string, newDueDate: Date) => {
       updateEngagementField(engagementId, 'dueDate', newDueDate.toISOString(), `Due date changed.`);
    };
     const handleStatusChange = (engagementId: string, newStatus: EngagementStatus, submitToBilling?: boolean) => {
        updateEngagementField(engagementId, 'status', newStatus, `Status changed to ${newStatus}.`);
    };
     const handleAssigneesChange = (engagementId: string, newAssignees: string[]) => {
        updateEngagementField(engagementId, 'assignedTo', newAssignees, "Assignees updated.");
    };
  
    const handleOpenEditSheet = (engagement: Engagement) => {
        setSelectedEngagement(engagement);
        setIsSheetOpen(true);
    };

    const handleCloseEditSheet = () => {
        setIsSheetOpen(false);
        setSelectedEngagement(null);
    };

    const handleSaveEngagement = async (engagementData: Partial<Engagement>) => {
        if (!selectedEngagement?.id || !currentUserEmployee) return;
        // This removes helper properties that are not in the database schema
        const { clientName, engagementTypeName, ...dataToSave } = engagementData as any;
        try {
            const engagementRef = doc(db, "engagements", selectedEngagement.id);
            await updateDoc(engagementRef, dataToSave);
            toast({ title: "Success", description: "Engagement updated successfully." });
            handleCloseEditSheet();
        } catch (error) {
            console.error("Error saving engagement:", error);
            toast({ title: "Error", description: "Failed to save engagement data.", variant: "destructive" });
        }
    };

  if (loading) {
    return <div>Loading workspace...</div>;
  }

  if (!client) {
    notFound();
    return null;
  }

  const getEngagementType = (typeId: string) => engagementTypes.find(et => et.id === typeId);
  
  const typedSelectedEngagement = selectedEngagement ? {
    ...selectedEngagement,
    clientName: client.name,
    engagementTypeName: getEngagementType(selectedEngagement.type)?.name || selectedEngagement.type,
  } : null;

  return (
    <>
      <div className="mb-4">
        <Button asChild variant="outline" size="sm">
            <Link href="/workspace">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Workspace
            </Link>
        </Button>
      </div>
       <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="font-headline text-2xl">{client.name}'s Workspace</CardTitle>
              <CardDescription>
                Viewing all engagements for {client.name} (PAN: {client.pan || 'N/A'}).
              </CardDescription>
            </div>
             <div className="flex items-center gap-2">
                {client.mobileNumber && (
                    <Button variant="outline" asChild>
                        <a href={`tel:${client.mobileNumber}`}>
                            <Phone />
                            Call Client
                        </a>
                    </Button>
                )}
                {client.mailId && (
                    <Button variant="outline" asChild>
                        <a href={`mailto:${client.mailId}`}>
                            <Mail />
                            Email Client
                        </a>
                    </Button>
                )}
                 <Button variant="outline" onClick={() => setIsHistoryOpen(true)}>
                    <History className="mr-2" />
                    View History
                </Button>
            </div>
        </CardHeader>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Active Engagements</CardTitle>
                <CardDescription>
                  Ongoing tasks and assignments for this client.
                </CardDescription>
              </div>
              <Button variant="outline" onClick={() => setIsPastEngagementsOpen(true)}>
                  <History className="mr-2 h-4 w-4" />
                  View Past
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full whitespace-nowrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {engagements.length > 0 ? (
                      engagements.map((eng) => {
                        const engagementType = getEngagementType(eng.type);
                        return (
                          <TableRow key={eng.id}>
                            <TableCell className="font-medium">
                                <Button variant="link" asChild className="p-0 h-auto font-medium">
                                    <Link href={`/workflow/${eng.id}`}>
                                        {eng.remarks}
                                    </Link>
                                </Button>
                            </TableCell>
                            <TableCell>{engagementType?.name || 'N/A'}</TableCell>
                            <TableCell>
                                <EditableDueDate engagement={eng} onDueDateChange={handleDueDateChange} />
                            </TableCell>
                            <TableCell>
                              <EditableStatus
                                    engagement={eng}
                                    client={client}
                                    onStatusChange={handleStatusChange}
                                />
                            </TableCell>
                            <TableCell>
                              <EditableAssignees
                                    engagement={eng}
                                    allEmployees={employees}
                                    onAssigneesChange={handleAssigneesChange}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => handleOpenEditSheet(eng)}>
                                    <Edit className="h-4 w-4"/>
                                </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center h-24">
                          No active engagements found for this client.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
        <div>
            <ClientNotes 
                clientId={clientId}
                clientName={client.name}
                allEmployees={employees}
                currentUserEmployee={currentUserEmployee}
            />
        </div>
      </div>
      <PastEngagementsDialog
        isOpen={isPastEngagementsOpen}
        onClose={() => setIsPastEngagementsOpen(false)}
        clientId={clientId}
        clientName={client.name}
        employees={employees}
        engagementTypes={engagementTypes}
        currentUser={currentUserEmployee}
      />
       <EngagementHistoryDialog
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        clientId={clientId}
        clientName={client.name}
        employees={employees}
        engagementTypes={engagementTypes}
      />
      <EditEngagementSheet
        isOpen={isSheetOpen}
        onClose={handleCloseEditSheet}
        onSave={handleSaveEngagement}
        engagement={typedSelectedEngagement}
        allEmployees={employees}
        allClients={allClients}
      />
    </>
  );
}
