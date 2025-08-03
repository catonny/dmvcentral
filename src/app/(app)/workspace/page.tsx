
"use client";

import * as React from "react";
import { collection, query, orderBy, onSnapshot, where, getDocs } from "firebase/firestore";
import type { Client, Engagement, Employee } from "@/lib/data";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function WorkspacePage() {
  const [allClients, setAllClients] = React.useState<Client[]>([]);
  const [currentUserEmployee, setCurrentUserEmployee] = React.useState<Employee | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  
  React.useEffect(() => {
    if (!user) return;
    setLoading(true);

    const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
    const employeePromise = getDocs(employeeQuery);

    const clientsQuery = query(collection(db, "clients"), orderBy("Name"));
    const clientsUnsub = onSnapshot(clientsQuery, (snapshot) => {
        const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        
        employeePromise.then(employeeSnapshot => {
            if (employeeSnapshot.empty) {
                setAllClients([]);
                setCurrentUserEmployee(null);
                setLoading(false);
                return;
            }
            
            const employee = { id: employeeSnapshot.docs[0].id, ...employeeSnapshot.docs[0].data() } as Employee;
            setCurrentUserEmployee(employee);

            if (employee.role.includes("Partner") || employee.role.includes("Admin")) {
                setAllClients(clientsData);
            } else {
                // For non-partners, we need to find which clients they have engagements for.
                const engagementsQuery = query(collection(db, "engagements"), where("assignedTo", "==", employee.id));
                getDocs(engagementsQuery).then(engagementsSnapshot => {
                    const clientIds = new Set(engagementsSnapshot.docs.map(doc => doc.data().clientId));
                    const visibleClients = clientsData.filter(client => clientIds.has(client.id));
                    setAllClients(visibleClients);
                });
            }
            setLoading(false);
        }).catch(error => {
            console.error("Error resolving employee data:", error);
            setLoading(false);
        });

    }, (error) => {
        console.error("Error fetching clients:", error);
        toast({ title: "Error", description: "Could not fetch clients.", variant: "destructive" });
        setLoading(false);
    });

    return () => clientsUnsub();
  }, [user, toast]);

  const filteredClients = React.useMemo(() => {
    if (!searchQuery) {
      return allClients;
    }
    return allClients.filter(client =>
      client.Name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allClients, searchQuery]);

  if (loading) {
    return <div className="flex h-full w-full items-center justify-center">Loading client workspaces...</div>;
  }

  return (
    <div className="flex flex-col h-full">
        <div className="mb-4">
            <h2 className="text-3xl font-bold tracking-tight font-headline">Client Workspaces</h2>
            <p className="text-muted-foreground">
                Select a client to view their engagements and details.
            </p>
        </div>
         <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
                type="search"
                placeholder="Search for a client by name..."
                className="w-full pl-10 py-6 text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
        <ScrollArea className="flex-grow">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.length > 0 ? (
                filteredClients.map(client => (
                    <Link href={`/workspace/${client.id}`} key={client.id} className="block">
                        <Card className="hover:bg-white/10 hover:border-primary/50 transition-colors h-full">
                            <CardHeader className="flex-row gap-4 items-center">
                                <Avatar className="h-12 w-12">
                                    <AvatarFallback>{client.Name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <CardTitle className="text-lg">{client.Name}</CardTitle>
                                    <CardDescription>{client.Category || 'N/A'}</CardDescription>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
                            </CardHeader>
                        </Card>
                    </Link>
                ))
            ) : (
                <div className="md:col-span-2 lg:col-span-3 text-center text-muted-foreground py-10">
                    No clients found.
                </div>
            )}
            </div>
        </ScrollArea>
    </div>
  );
}
