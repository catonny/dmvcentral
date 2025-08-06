
"use client";

import * as React from "react";
import type { Client, Engagement, Employee, Todo } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Loader2 } from "lucide-react";
import { collection, onSnapshot, query, where, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "../ui/button";
import { TodoDetailsDialog } from "./todo-details-dialog";
import { sendEmail } from "@/ai/flows/send-email-flow";

type TodoItemType = "missing-reporter" | "unassigned" | "incomplete-client-data" | "fee-revision";

export function TodoSection({ currentUser }: { currentUser: Employee | null }) {
    const [engagementsWithMissingReporter, setEngagementsWithMissingReporter] = React.useState<Engagement[]>([]);
    const [unassignedEngagements, setUnassignedEngagements] = React.useState<Engagement[]>([]);
    const [incompleteClients, setIncompleteClients] = React.useState<Client[]>([]);
    const [feeRevisionTodos, setFeeRevisionTodos] = React.useState<Todo[]>([]);
    const [loading, setLoading] = React.useState(false);
    const { toast } = useToast();
    
    const [isDetailDialogOpen, setIsDetailDialogOpen] = React.useState(false);
    const [detailDialogData, setDetailDialogData] = React.useState<{ title: string, engagements?: Engagement[], clients?: Client[] } | null>(null);

    React.useEffect(() => {
        if (!currentUser) return;

        const isAdmin = currentUser.role.includes("Admin");
        const isPartner = currentUser.role.includes("Partner");

        // Queries for Engagements
        const reporterQuery = query(collection(db, "engagements"), where("reportedTo", "in", [null, ""]));
        const unassignedQuery = query(collection(db, "engagements"), where("assignedTo", "==", []));
        const feeRevisionQuery = query(collection(db, "todos"), where("type", "==", "FEE_REVISION_APPROVAL"), where("status", "==", "Pending"), where("userId", "==", currentUser.id));

        const unsubReporter = onSnapshot(reporterQuery, (snap) => setEngagementsWithMissingReporter(snap.docs.map(doc => doc.data() as Engagement)));
        const unsubUnassigned = onSnapshot(unassignedQuery, (snap) => setUnassignedEngagements(snap.docs.map(doc => doc.data() as Engagement)));
        const unsubFeeRevisions = onSnapshot(feeRevisionQuery, (snap) => setFeeRevisionTodos(snap.docs.map(doc => doc.data() as Todo)));
        
        // Queries for incomplete clients
        const panQuery = query(collection(db, "clients"), where("pan", "==", "PANNOTAVLBL"));
        const mobileQuery = query(collection(db, "clients"), where("mobileNumber", "==", "1111111111"));
        const mailQuery = query(collection(db, "clients"), where("mailId", "==", "mail@notavailable.com"));

        const combineAndFilterClients = (panSnap: any, mobileSnap: any, mailSnap: any) => {
             const allIncompleteMap = new Map<string, Client>();
             
             panSnap.docs.forEach((doc: any) => allIncompleteMap.set(doc.id, { id: doc.id, ...doc.data() } as Client));
             mobileSnap.docs.forEach((doc: any) => allIncompleteMap.set(doc.id, { id: doc.id, ...doc.data() } as Client));
             mailSnap.docs.forEach((doc: any) => allIncompleteMap.set(doc.id, { id: doc.id, ...doc.data() } as Client));

            let finalClients = Array.from(allIncompleteMap.values());
            
            if (isPartner && !isAdmin) {
                finalClients = finalClients.filter(c => c.partnerId === currentUser.id);
            }
            setIncompleteClients(finalClients);
        };

        const unsubPan = onSnapshot(panQuery, (panSnapshot) => {
            getDocs(mobileQuery).then(mobileSnapshot => {
                getDocs(mailQuery).then(mailSnapshot => {
                    combineAndFilterClients(panSnapshot, mobileSnapshot, mailSnapshot);
                });
            });
        });

        const unsubMobile = onSnapshot(mobileQuery, (mobileSnapshot) => {
             getDocs(panQuery).then(panSnapshot => {
                getDocs(mailQuery).then(mailSnapshot => {
                    combineAndFilterClients(panSnapshot, mobileSnapshot, mailSnapshot);
                });
            });
        });
        
        const unsubMail = onSnapshot(mailQuery, (mailSnapshot) => {
             getDocs(panQuery).then(panSnapshot => {
                getDocs(mobileQuery).then(mobileSnapshot => {
                    combineAndFilterClients(panSnapshot, mobileSnapshot, mailSnapshot);
                });
            });
        });

        return () => {
            unsubReporter();
            unsubUnassigned();
            unsubPan();
            unsubMobile();
            unsubMail();
            unsubFeeRevisions();
        };
    }, [currentUser]);
    
    const openDetails = (type: TodoItemType, data?: any) => {
        // This part would need to be expanded to handle the new todo type in a dialog if needed
    };

    const handleSendConfirmationEmail = async (todo: Todo) => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const { clientName, engagementTypeName, oldFee, newFee } = todo.relatedData;
            const clientDoc = await getDoc(doc(db, "clients", todo.clientId));
            if (!clientDoc.exists()) throw new Error("Client not found");
            const clientEmail = clientDoc.data().mailId;

            const subject = `Important Update: Revision of Professional Fees for ${engagementTypeName}`;
            const body = `Dear ${clientName},

We hope this email finds you well.

This is to formally notify you of a revision in our professional fees for the recurring ${engagementTypeName} service we provide for you.

The fee for this service will be updated from ₹${oldFee} to ₹${newFee}, effective from the next billing cycle.

This adjustment allows us to continue providing the high-quality service you have come to expect from us.

Please feel free to reply to this email if you have any questions. We appreciate your understanding and look forward to our continued partnership.

Warm regards,

${currentUser.name}
Davis Martin & Varghese`;
            
            await sendEmail({ recipientEmails: [clientEmail], subject, body });
            await updateDoc(doc(db, "todos", todo.id), { status: "Completed" });

            toast({ title: "Email Sent", description: "Confirmation email has been sent to the client."});
        } catch (err) {
            toast({ title: "Error", description: "Failed to send email.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }
    
    const todos = React.useMemo(() => {
        if (!currentUser) return [];

        const isAdmin = currentUser.role.includes("Admin");
        const isPartner = currentUser.role.includes("Partner");

        const todoList = [];
        
        if (isAdmin && engagementsWithMissingReporter.length > 0) todoList.push({ id: "missing-reporter", field: "Engagement Reporter Not Assigned", count: engagementsWithMissingReporter.length });
        if (isAdmin && unassignedEngagements.length > 0) todoList.push({ id: "unassigned", field: "Engagements Not Assigned to Employee", count: unassignedEngagements.length });
        if ((isAdmin || isPartner) && incompleteClients.length > 0) todoList.push({ id: "incomplete-client-data", field: `Clients with Missing Mandatory Data ${isPartner && !isAdmin ? "(Yours)" : ""}`, count: incompleteClients.length });
        
        feeRevisionTodos.forEach(todo => {
            todoList.push({
                id: todo.id,
                field: `Confirm fee revision for ${todo.relatedData.clientName} (${todo.relatedData.engagementTypeName})`,
                count: 1,
                action: () => handleSendConfirmationEmail(todo),
                actionLabel: "Send Email"
            });
        });

        return todoList;
    }, [currentUser, engagementsWithMissingReporter, unassignedEngagements, incompleteClients, feeRevisionTodos]);

    if (todos.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>To-Do List</CardTitle>
                    <CardDescription>Action items that require your attention.</CardDescription>
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
                    <CardDescription>The following items require your urgent attention.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2">
                        {todos.map(todo => (
                            <li key={todo.id} className="flex justify-between items-center bg-muted/50 p-3 rounded-md">
                            <div className="flex-1">
                                <span className="font-medium text-sm text-foreground/80">{todo.field}</span>
                                {todo.count > 1 && <span className="ml-3 text-sm font-bold text-destructive bg-destructive/20 rounded-full px-2.5 py-1">{todo.count}</span>}
                            </div>
                            {todo.action && (
                                <Button size="sm" variant="outline" onClick={todo.action} disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {todo.actionLabel || 'Details'}
                                </Button>
                            )}
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </>
    )
}
