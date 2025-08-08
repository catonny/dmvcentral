
"use client";

import * as React from "react";
import type { Client, Employee, Todo } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Check, Edit, Loader2, PlusCircle, Send, User, Users } from "lucide-react";
import { collection, onSnapshot, query, where, getDocs, writeBatch, doc, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { ScrollArea } from "../ui/scroll-area";
import { TodoDetailsDialog } from "./todo-details-dialog";
import { Badge } from "../ui/badge";
import { EditClientSheet } from "./edit-client-sheet";
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


export function TodoSection({ currentUser, allClients, allEmployees }: { currentUser: Employee | null, allClients: Client[], allEmployees: Employee[] }) {
    const [todos, setTodos] = React.useState<Todo[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isAdding, setIsAdding] = React.useState(false);
    const [newTodoText, setNewTodoText] = React.useState("");
    const [incompleteClients, setIncompleteClients] = React.useState<Client[]>([]);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false);
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = React.useState(false);
    const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);

    const { toast } = useToast();

    React.useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const todosQuery = query(collection(db, "todos"), where("assignedTo", "array-contains", currentUser.id), where("isCompleted", "==", false));
        const unsubTodos = onSnapshot(todosQuery, (snap) => {
            const fetchedTodos = snap.docs.map(doc => doc.data() as Todo);
            setTodos(fetchedTodos.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        });

        // Separate logic for incomplete clients
        const clientsWithIncompleteData = allClients
            .filter(c => c.partnerId === currentUser.id)
            .filter(c => c.pan === 'PANNOTAVLBL' || c.mailId === 'unassigned' || c.mobileNumber === '1111111111');
        
        setIncompleteClients(clientsWithIncompleteData);
        setLoading(false);

        return () => unsubTodos();
    }, [currentUser, allClients]);
    
    const handleAddTodo = async () => {
        if (!newTodoText.trim() || !currentUser) return;
        setIsAdding(true);

        const mentions = newTodoText.match(/@(\w+)/g)?.map(m => m.substring(1)) || [];
        const assignedToIds = new Set([currentUser.id]);
        
        mentions.forEach(mentionName => {
            const employee = allEmployees.find(e => e.name.toLowerCase().replace(/\s/g, '') === mentionName.toLowerCase());
            if (employee) {
                assignedToIds.add(employee.id);
            }
        });

        try {
            const newTodoRef = doc(collection(db, "todos"));
            const newTodo: Todo = {
                id: newTodoRef.id,
                type: 'GENERAL_TASK',
                text: newTodoText,
                createdBy: currentUser.id,
                assignedTo: Array.from(assignedToIds),
                isCompleted: false,
                createdAt: new Date().toISOString(),
            };
            await addDoc(collection(db, "todos"), newTodo);
            toast({ title: "To-Do Added" });
            setNewTodoText("");
        } catch (error) {
            toast({ title: "Error", description: "Could not add To-Do item.", variant: "destructive" });
        } finally {
            setIsAdding(false);
        }
    };
    
    const handleOpenEditSheet = (client: Client) => {
        setSelectedClient(client);
        setIsDetailsDialogOpen(false); // Close the list dialog
        setIsSheetOpen(true); // Open the edit sheet
    };
    
    const handleSaveClient = async (clientData: Partial<Client>) => {
        if (!selectedClient?.id) return;
        try {
            const clientRef = doc(db, "clients", selectedClient.id);
            await updateDoc(clientRef, { ...clientData, lastUpdated: new Date().toISOString() });
            toast({ title: "Success", description: "Client updated successfully." });
            setIsSheetOpen(false);
            setSelectedClient(null);
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
            toast({ title: "Success", description: `Client ${selectedClient.name} and all associated engagements have been deleted.` });
            setIsSheetOpen(false);
        } catch (error) {
            console.error("Error deleting client:", error);
            toast({ title: "Error", description: "Failed to delete client.", variant: "destructive" });
        } finally {
            setIsConfirmDeleteDialogOpen(false);
            setSelectedClient(null);
        }
    };

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div>
    }

    const hasNoTodos = todos.length === 0 && incompleteClients.length === 0;

    return (
        <>
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        To-Do List
                    </CardTitle>
                    <CardDescription>Action items that require your attention. Mention users with @.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-4 flex flex-col min-h-0">
                    <div className="flex gap-2">
                        <Textarea 
                            placeholder="Add a new to-do..."
                            value={newTodoText}
                            onChange={(e) => setNewTodoText(e.target.value)}
                        />
                        <Button onClick={handleAddTodo} disabled={isAdding}>
                            {isAdding ? <Loader2 className="animate-spin"/> : <Send/>}
                        </Button>
                    </div>
                    <ScrollArea className="flex-grow pr-4 -mr-4">
                        <div className="space-y-2">
                            {hasNoTodos ? (
                                <div className="text-center text-muted-foreground pt-8">
                                    <p className="text-lg font-semibold">All Caught Up!</p>
                                    <p>No pending actions required.</p>
                                </div>
                            ) : (
                                <>
                                 {incompleteClients.length > 0 && (
                                     <button
                                        className="w-full flex items-start gap-3 p-3 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-left"
                                        onClick={() => setIsDetailsDialogOpen(true)}
                                    >
                                        <Users className="h-5 w-5 mt-1 flex-shrink-0" />
                                        <div className="flex-grow">
                                            <p className="font-semibold text-sm">Update incomplete client data</p>
                                            <p className="text-xs">
                                                {incompleteClients.length} client(s) require attention.
                                            </p>
                                        </div>
                                         <Badge variant="destructive">{incompleteClients.length}</Badge>
                                    </button>
                                 )}
                                {todos.map(todo => (
                                    <div key={todo.id} className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                                        <Button size="icon" variant="ghost" className="h-6 w-6 mt-1">
                                        <Check className="h-4 w-4"/>
                                        </Button>
                                        <div className="flex-grow">
                                            <p className="text-sm">{todo.text}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                <User className="h-3 w-3"/>
                                                <span>{allEmployees.find(e => e.id === todo.createdBy)?.name || 'System'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                </>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
            <TodoDetailsDialog 
                isOpen={isDetailsDialogOpen}
                onClose={() => setIsDetailsDialogOpen(false)}
                title="Clients with Incomplete Data"
                clients={incompleteClients}
                onEditClient={handleOpenEditSheet}
            />
             <EditClientSheet
                client={selectedClient}
                isOpen={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
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
        </>
    );
}
