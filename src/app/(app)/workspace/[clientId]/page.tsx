
"use client";

import * as React from "react";
import { doc, getDoc, collection, getDocs, query, where, onSnapshot } from "firebase/firestore";
import type { Client, Engagement, Employee, EngagementType } from "@/lib/data";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const statusColors: { [key: string]: string } = {
  "Pending": "bg-gray-200 text-gray-800",
  "Awaiting Documents": "bg-yellow-200 text-yellow-800",
  "In Process": "bg-blue-200 text-blue-800",
  "Partner Review": "bg-purple-200 text-purple-800",
  "Completed": "bg-green-200 text-green-800",
  "Cancelled": "bg-red-200 text-red-800",
};

export default function ClientWorkspacePage({ params: { clientId } }: { params: { clientId: string } }) {
  const [client, setClient] = React.useState<Client | null>(null);
  const [engagements, setEngagements] = React.useState<Engagement[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);
  const [loading, setLoading] = React.useState(true);
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
        // Handle case where client is deleted while user is on the page
        setClient(null);
      }
      setLoading(false); // Assume loading is done after client is fetched/not-found
    }, (error) => handleError(error, 'client details'));

    // Fetch employees and engagement types (usually static, so one-time fetch is fine)
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

    // Listen to engagements for the client
    const engagementsQuery = query(collection(db, "engagements"), where("clientId", "==", clientId));
    const engagementsUnsub = onSnapshot(engagementsQuery, (snapshot) => {
      const engagementsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Engagement))
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
      setEngagements(engagementsData);
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
            </div>
        </CardHeader>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Engagements</CardTitle>
          <CardDescription>
            Tasks and assignments for this client, sorted by the nearest due date.
          </CardDescription>
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
                    const assignedEmployee = getEmployeeMember(eng.assignedTo);
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
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={assignedEmployee?.avatar} alt={assignedEmployee?.name} />
                              <AvatarFallback>{assignedEmployee?.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>{assignedEmployee?.name || 'Unassigned'}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
                      No engagements found for this client.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  );
}
