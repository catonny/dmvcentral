
"use client";

import * as React from "react";
import type { Client, Engagement, Employee } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Loader2 } from "lucide-react";
import { collection, onSnapshot, query, where, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "../ui/button";
import { TodoDetailsDialog } from "./todo-details-dialog";

type TodoItemType = "missing-reporter" | "unassigned" | "incomplete-client-data";

export function TodoSection() {
    const [engagementsWithMissingReporter, setEngagementsWithMissingReporter] = React.useState<Engagement[]>([]);
    const [unassignedEngagements, setUnassignedEngagements] = React.useState<Engagement[]>([]);
    const [incompleteClients, setIncompleteClients] = React.useState<Client[]>([]);
    const [loading, setLoading] = React.useState(false);
    const { toast } = useToast();
    
    const [isDetailDialogOpen, setIsDetailDialogOpen] = React.useState(false);
    const [detailDialogData, setDetailDialogData] = React.useState<{ title: string, engagements?: Engagement[], clients?: Client[] } | null>(null);

    React.useEffect(() => {
        const reporterQuery = query(collection(db, "engagements"), where("reportedTo", "in", [null, ""]));
        const unassignedQuery = query(collection(db, "engagements"), where("assignedTo", "==", []));
        
        // Setup queries for all incomplete data conditions
        const panQuery = query(collection(db, "clients"), where("pan", "==", "PANNOTAVLBL"));
        const mobileQuery = query(collection(db, "clients"), where("mobileNumber", "==", "1111111111"));
        const mailQuery = query(collection(db, "clients"), where("mailId", "==", "mail@notavailable.com"));


        const unsubReporter = onSnapshot(reporterQuery, (querySnapshot) => {
            setEngagementsWithMissingReporter(querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Engagement) ));
        }, (error) => {
            console.error("Error fetching engagements with missing reporter: ", error);
            toast({ title: "Error", description: "Could not fetch to-do list for reporters.", variant: "destructive" });
        });

        const unsubUnassigned = onSnapshot(unassignedQuery, (querySnapshot) => {
            setUnassignedEngagements(querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Engagement)));
        }, (error) => {
            console.error("Error fetching unassigned engagements: ", error);
            toast({ title: "Error", description: "Could not fetch to-do list for assignments.", variant: "destructive" });
        });
        
        const combineIncompleteClients = (snapshots: (any | undefined)[]) => {
            const allIncomplete = new Map<string, Client>();
            snapshots.forEach(snapshot => {
                if (snapshot && snapshot.docs) {
                    snapshot.docs.forEach((doc: any) => {
                        const clientData = doc.data() as Client;
                        // Ensure clientData and its id are valid before setting
                        if (clientData && clientData.id && !allIncomplete.has(clientData.id)) {
                            allIncomplete.set(clientData.id, clientData);
                        }
                    });
                }
            });
            setIncompleteClients(Array.from(allIncomplete.values()));
        };
        
        let panSnapshot: any;
        let mobileSnapshot: any;
        let mailSnapshot: any;

        const unsubPan = onSnapshot(panQuery, (snapshot) => {
            panSnapshot = snapshot;
            combineIncompleteClients([panSnapshot, mobileSnapshot, mailSnapshot]);
        });
        const unsubMobile = onSnapshot(mobileQuery, (snapshot) => {
            mobileSnapshot = snapshot;
            combineIncompleteClients([panSnapshot, mobileSnapshot, mailSnapshot]);
        });
        const unsubMail = onSnapshot(mailQuery, (snapshot) => {
            mailSnapshot = snapshot;
            combineIncompleteClients([panSnapshot, mobileSnapshot, mailSnapshot]);
        });

        return () => {
            unsubReporter();
            unsubUnassigned();
            unsubPan();
            unsubMobile();
            unsubMail();
        };
    }, [toast]);
    
    const openDetails = (type: TodoItemType) => {
        if (type === "missing-reporter") {
            setDetailDialogData({
                title: "Engagements with Missing Reporter",
                engagements: engagementsWithMissingReporter
            });
        } else if (type === "unassigned") {
            setDetailDialogData({
                title: "Unassigned Engagements",
                engagements: unassignedEngagements
            });
        } else if (type === "incomplete-client-data") {
            setDetailDialogData({
                title: "Clients with Incomplete Data",
                clients: incompleteClients
            });
        }
        setIsDetailDialogOpen(true);
    };
    
    const todos = React.useMemo(() => {
        const todoList: { id: TodoItemType; field: string; count: number; action?: () => void; }[] = [];
        
        if (engagementsWithMissingReporter.length > 0) {
            todoList.push({
                id: "missing-reporter",
                field: "Engagement Reporter Not Assigned",
                count: engagementsWithMissingReporter.length,
                action: () => openDetails("missing-reporter")
            });
        }
        
        if (unassignedEngagements.length > 0) {
            todoList.push({
                id: "unassigned",
                field: "Engagements Not Assigned to Employee",
                count: unassignedEngagements.length,
                action: () => openDetails("unassigned")
            });
        }
        
        if (incompleteClients.length > 0) {
            todoList.push({
                id: "incomplete-client-data",
                field: "Clients with Missing Mandatory Data",
                count: incompleteClients.length,
                action: () => openDetails("incomplete-client-data")
            });
        }

        return todoList;
    }, [engagementsWithMissingReporter, unassignedEngagements, incompleteClients]);

    if (todos.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>To-Do List</CardTitle>
                    <CardDescription>
                        Action items that require your attention.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                        <p className="text-lg font-semibold">All Caught Up!</p>
                        <p>No pending actions required at the moment.</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        To-Do List
                    </CardTitle>
                    <CardDescription>
                        The following items are not updated and require your urgent attention.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2">
                        {todos.map(todo => (
                            <li key={todo.id} className="flex justify-between items-center bg-muted/50 p-3 rounded-md">
                            <div className="flex-1">
                                <span className="font-medium text-sm text-foreground/80">{todo.field}</span>
                                <span className="ml-3 text-sm font-bold text-destructive bg-destructive/20 rounded-full px-2.5 py-1">
                                    {todo.count}
                                </span>
                            </div>
                            {todo.action && (
                                    <Button size="sm" variant="outline" onClick={todo.action} disabled={loading}>
                                        Details
                                    </Button>
                            )}
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
            <TodoDetailsDialog 
                isOpen={isDetailDialogOpen}
                onClose={() => setIsDetailDialogOpen(false)}
                title={detailDialogData?.title || ""}
                engagements={detailDialogData?.engagements}
                clients={detailDialogData?.clients}
            />
        </>
    )
}
