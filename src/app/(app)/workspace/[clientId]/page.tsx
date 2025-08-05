
"use client";

import * as React from "react";
import { doc, getDoc, collection, getDocs, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Client, Engagement, Employee, EngagementType, EngagementStatus } from "@/lib/data";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, History } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PastEngagementsDialog } from "@/components/workspace/past-engagements-dialog";
import { EngagementHistoryDialog } from "@/components/workspace/engagement-history-dialog";

const statusColors: { [key: string]: string } = {
  "Pending": "bg-gray-200 text-gray-800",
  "Awaiting Documents": "bg-yellow-200 text-yellow-800",
  "In Process": "bg-blue-200 text-blue-800",
  "Partner Review": "bg-purple-200 text-purple-800",
  "Completed": "bg-green-200 text-green-800",
  "Cancelled": "bg-red-200 text-red-800",
};

export default function ClientWorkspacePage({ params }: { params: { clientId: string } }) {
  const clientId = params.clientId;
  const [client, setClient] = React.useState<Client | null>(null);
  const [engagements, setEngagements] = React.useState<Engagement[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
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

    // Listen to *active* engagements for the client
    const activeStatuses: EngagementStatus[] = ["Pending", "Awaiting Documents", "In Process", "Partner Review"];
    const engagementsQuery = query(
        collection(db, "engagements"), 
        where("clientId", "==", clientId),
        where("status", "in", activeStatuses)
    );
    const engagementsUnsub = onSnapshot(engagementsQuery, (snapshot) => {
      const engagementsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Engagement));
      // Sort on the client-side
      const sortedEngagements = engagementsData.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setEngagements(sortedEngagements);
    }, (error) => handleError(error, 'engagements'));

    return () => {
      clientUnsub();
      engagementsUnsub();
    };
  }, [clientId, toast]);


  if (loading) {
    return <div>Loading workspace...</div>;
  }

  if (!client) {
    notFound();
    return null;
  }

  const getEmployeeMember = (employeeId: string) => employees.find(s => s.id === employeeId);
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
              <CardTitle className="font-headline text-2xl">{client.Name}'s Workspace</CardTitle>
              <CardDescription>
                Viewing all engagements for {client.Name} (PAN: {client.PAN || 'N/A'}).
              </CardDescription>
            </div>
             <div className="flex items-center gap-2">
                {client['Mobile Number'] && (
                    <Button variant="outline" asChild>
                        <a href={`tel:${client['Mobile Number']}`}>
                            <Phone />
                            Call Client
                        </a>
                    </Button>
                )}
                {client['Mail ID'] && (
                    <Button variant="outline" asChild>
                        <a href={`mailto:${client['Mail ID']}`}>
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
                    const assignedToIds = Array.isArray(eng.assignedTo) ? eng.assignedTo : [eng.assignedTo].filter(Boolean);
                    const assignedEmployees = assignedToIds.map(getEmployeeMember).filter(Boolean);
                    const engagementType = getEngagementType(eng.type);
                    return (
                      <TableRow key={eng.id}>
                        <TableCell className="font-medium">{eng.remarks}</TableCell>
                        <TableCell>{engagementType?.name || 'N/A'}</TableCell>
                        <TableCell>{format(parseISO(eng.dueDate), "dd MMM, yyyy")}</TableCell>
                        <TableCell>
                          <Badge className={`${statusColors[eng.status] || ''} hover:${statusColors[eng.status] || ''}`}>
                              {eng.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                           <div className="flex items-center -space-x-2">
                            {assignedEmployees.map(employee => (
                                <Avatar key={employee.id} className="h-8 w-8 border-2 border-background">
                                <AvatarImage src={employee.avatar} alt={employee.name} />
                                <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                            ))}
                            {assignedEmployees.length === 0 && <span>Unassigned</span>}
                           </div>
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
        clientName={client.Name}
        employees={employees}
        engagementTypes={engagementTypes}
      />
       <EngagementHistoryDialog
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        clientId={clientId}
        clientName={client.Name}
        employees={employees}
        engagementTypes={engagementTypes}
      />
    </>
  );
}
