

"use client";

import * as React from "react";
import { getDoc, collection, getDocs, query, where, onSnapshot, orderBy, updateDoc } from "firebase/firestore";
import type { Client, Engagement, Employee, EngagementType, EngagementStatus } from "@/lib/data";
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


export default function ClientWorkspacePage() {
  const params = useParams();
  const { user } = useAuth();
  const clientId = params.clientId as string;
  const [client, setClient] = React.useState<Client | null>(null);
  const [engagements, setEngagements] = React.useState<Engagement[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [currentUserEmployee, setCurrentUserEmployee] = React.useState<Employee | null>(null);
  const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isPastEngagementsOpen, setIsPastEngagementsOpen] = React.useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
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

    // Listen to client document
    const clientUnsub = onSnapshot(doc(db, "clients", clientId), (doc) => {
      if (doc.exists()) {
        setClient({ id: doc.id, ...doc.data() } as Client);
      } else {
        setClient(null);
      }
      setLoading(false);
    }, (error) => handleError(error, 'client details'));

    const fetchStaticData = async () => {
        try {
            const [employeeSnapshot, engagementTypesSnapshot] = await Promise.all([
                getDocs(query(collection(db, "employees"))),
                getDocs(query(collection(db, "engagementTypes")))
            ]);
            setEmployees(employeeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
            setEngagementTypes(engagementTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EngagementType)));
        } catch (error) {
            handleError(error as Error, 'master');
        }
    };
    fetchStaticData();

    // The query that requires an index
    const activeStatuses: EngagementStatus[] = ["Pending", "Awaiting Documents", "In Process", "Partner Review", "On Hold"];
    const engagementsQuery = query(
        collection(db, "engagements"), 
        where("clientId", "==", clientId),
        where("status", "in", activeStatuses),
        orderBy("dueDate", "asc")
    );

    const engagementsUnsub = onSnapshot(engagementsQuery, (snapshot) => {
      const fetchedEngagements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
      setEngagements(fetchedEngagements);
    }, (error) => handleError(error, 'engagements'));

    return () => {
      clientUnsub();
      engagementsUnsub();
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


  if (loading) {
    return <div>Loading workspace...</div>;
  }

  if (!client) {
    notFound();
    return null;
  }

  const getEngagementType = (typeId: string) => engagementTypes.find(et => et.id === typeId);

  return (
    <>
      <div className="mb-4">
        <Button asChild variant="outline" size="sm">
            <Link href="/workspace">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Clients
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
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Active Engagements</CardTitle>
            <CardDescription>
              Ongoing tasks and assignments for this client, sorted by the nearest due date.
            </CardDescription>
          </div>
           <Button variant="outline" onClick={() => setIsPastEngagementsOpen(true)}>
              <History className="mr-2 h-4 w-4" />
              View Past Engagements
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
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
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
    </>
  );
}
