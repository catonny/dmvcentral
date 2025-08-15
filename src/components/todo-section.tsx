

"use client";

import * as React from "react";
import type { Client, Employee, Todo } from "@/lib/data";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Check, ChevronDown, Edit, Loader2, MoreHorizontal, PlusCircle, Send, Trash2, User, Users } from "lucide-react";
import { collection, onSnapshot, query, where, getDocs, writeBatch, doc, addDoc, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { db, notify } from "@/lib/firebase";
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
import { Checkbox } from "../ui/checkbox";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";


export function TodoSection({ currentUser, allClients, allEmployees }: { currentUser: Employee | null, allClients: Client[], allEmployees: Employee[] }) {
    const [todos, setTodos] = React.useState<Todo[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isAdding, setIsAdding] = React.useState(false);
    const [newTodoText, setNewTodoText] = React.useState("");
    const [editingTodo, setEditingTodo] = React.useState<Todo | null>(null);
    const [editingText, setEditingText] = React.useState("");
    const [incompleteClients, setIncompleteClients] = React.useState<Client[]>([]);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = React.useState(false);
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = React.useState(false);
    const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);

    // State for @mention functionality
    const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
    const [isMentionPopoverOpen, setIsMentionPopoverOpen] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const { toast } = useToast();

    React.useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const todosQuery = query(collection(db, "todos"), where("assignedTo", "array-contains", currentUser.id));
        const unsubTodos = onSnapshot(todosQuery, (snap) => {
            const fetchedTodos = snap.docs.map(doc => doc.data() as Todo);
            setTodos(fetchedTodos.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        });

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
        
        const mentionedEmployees = allEmployees.filter(e => 
            mentions.some(mentionName => e.name.toLowerCase().replace(/\s/g, '') === mentionName.toLowerCase())
        );

        mentionedEmployees.forEach(employee => {
            assignedToIds.add(employee.id);
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
            await setDoc(newTodoRef, newTodo);
            
            // Notify mentioned users
            await notify({
                recipients: Array.from(assignedToIds),
                type: 'MENTIONED_IN_TODO',
                text: `${currentUser.name} mentioned you in a to-do: "${newTodoText.substring(0, 30)}..."`,
                relatedEntity: { type: 'todo', id: newTodo.id },
                triggeringUser: currentUser,
            });

            toast({ title: "To-Do Added" });
            setNewTodoText("");
        } catch (error) {
            toast({ title: "Error", description: "Could not add To-Do item.", variant: "destructive" });
        } finally {
            setIsAdding(false);
        }
    };
    
    const handleToggleTodoComplete = async (todo: Todo) => {
        if (!currentUser) return;
        const todoRef = doc(db, "todos", todo.id);
        const newStatus = !todo.isCompleted;
        try {
            await updateDoc(todoRef, {
                isCompleted: newStatus,
                completedAt: newStatus ? new Date().toISOString() : undefined,
                completedBy: newStatus ? currentUser.id : undefined,
            });
        } catch (error) {
            toast({ title: "Error", description: "Could not update to-do status.", variant: "destructive"});
        }
    };

    const handleEditTodo = (todo: Todo) => {
        setEditingTodo(todo);
        setEditingText(todo.text);
    };
    
    const handleUpdateTodo = async () => {
        if (!editingTodo || !editingText.trim()) return;
        const todoRef = doc(db, "todos", editingTodo.id);
        try {
            await updateDoc(todoRef, { text: editingText });
            setEditingTodo(null);
            setEditingText("");
            toast({ title: "Success", description: "To-Do updated." });
        } catch (error) {
             toast({ title: "Error", description: "Could not update to-do.", variant: "destructive"});
        }
    };

    const handleDeleteTodo = async (todoId: string) => {
        try {
            await deleteDoc(doc(db, "todos", todoId));
            toast({ title: "Success", description: "To-Do deleted." });
        } catch (error) {
            toast({ title: "Error", description: "Could not delete to-do.", variant: "destructive" });
        }
    };
    
     const handleClearCompleted = async () => {
        const completedIds = todos.filter(t => t.isCompleted).map(t => t.id);
        if (completedIds.length === 0) return;
        const batch = writeBatch(db);
        completedIds.forEach(id => {
            batch.delete(doc(db, "todos", id));
        });
        try {
            await batch.commit();
            toast({ title: "Success", description: "All completed to-dos cleared." });
        } catch (error) {
            toast({ title: "Error", description: "Could not clear completed to-dos.", variant: "destructive" });
        }
    };

    const handleOpenEditSheet = (client: Client) => {
        setSelectedClient(client);
        setIsDetailsDialogOpen(false);
        setIsSheetOpen(true);
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

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setNewTodoText(text);

        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = text.slice(0, cursorPos);
        const mentionMatch = textBeforeCursor.match(/(?:\s|^)@(\w*)$/);

        if (mentionMatch) {
            setMentionQuery(mentionMatch[1].toLowerCase());
            setIsMentionPopoverOpen(true);
        } else {
            setIsMentionPopoverOpen(false);
            setMentionQuery(null);
        }
    };
    
    const handleMentionSelect = (employeeName: string) => {
        const text = newTodoText;
        const cursorPos = textareaRef.current?.selectionStart || 0;
        const textBeforeCursor = text.slice(0, cursorPos);
        
        const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
        if (mentionMatch) {
            const mentionStartIndex = mentionMatch.index || 0;
            const newText = 
                text.slice(0, mentionStartIndex) + 
                `@${employeeName.replace(/\s/g, '')} ` +
                text.slice(cursorPos);
            
            setNewTodoText(newText);
        }
        setIsMentionPopoverOpen(false);
        setMentionQuery(null);
        textareaRef.current?.focus();
    };

    const filteredEmployees = mentionQuery !== null 
        ? allEmployees.filter(e => e.name.toLowerCase().includes(mentionQuery))
        : [];

    const pendingTodos = todos.filter(t => !t.isCompleted);
    const completedTodos = todos.filter(t => t.isCompleted);
    const hasNoPendingItems = pendingTodos.length === 0 && incompleteClients.length === 0;

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div>
    }

    return (
        <>
            <Card className="h-full flex flex-col shadow-none border-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        To-Do List
                    </CardTitle>
                    <CardDescription>Action items that require your attention. Mention users with @.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-4 flex flex-col min-h-0">
                    <div className="relative">
                         <Popover open={isMentionPopoverOpen} onOpenChange={setIsMentionPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Textarea 
                                    ref={textareaRef}
                                    placeholder="Add a new to-do..."
                                    value={newTodoText}
                                    onChange={handleTextChange}
                                />
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <Command shouldFilter={false}>
                                    <CommandInput placeholder="Search employee..." value={mentionQuery || ''} onValueChange={setMentionQuery} />
                                    <CommandList>
                                        <CommandEmpty>No employee found.</CommandEmpty>
                                        <CommandGroup>
                                            {filteredEmployees.map(employee => (
                                                <CommandItem
                                                    key={employee.id}
                                                    value={employee.name}
                                                    onSelect={() => handleMentionSelect(employee.name)}
                                                >
                                                    {employee.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <Button onClick={handleAddTodo} disabled={isAdding} className="absolute bottom-2 right-2 h-7 w-7" size="icon">
                            {isAdding ? <Loader2 className="animate-spin h-4 w-4"/> : <Send className="h-4 w-4"/>}
                        </Button>
                    </div>
                    <ScrollArea className="flex-grow pr-4 -mr-4">
                        <div className="space-y-2">
                            {hasNoPendingItems ? (
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
                                {pendingTodos.map(todo => (
                                    <div key={todo.id} className="flex items-start gap-3 p-2 rounded-md bg-muted/50 group">
                                        <Checkbox
                                            id={`todo-${todo.id}`}
                                            checked={todo.isCompleted}
                                            onCheckedChange={() => handleToggleTodoComplete(todo)}
                                            className="mt-1"
                                        />
                                        <div className="flex-grow">
                                            {editingTodo?.id === todo.id ? (
                                                <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} onBlur={handleUpdateTodo} autoFocus />
                                            ) : (
                                                <p className={cn("text-sm", todo.isCompleted && "line-through text-muted-foreground")}>{todo.text}</p>
                                            )}
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                <User className="h-3 w-3"/>
                                                <span>{allEmployees.find(e => e.id === todo.createdBy)?.name || 'System'}</span>
                                            </div>
                                        </div>
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4"/></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onClick={() => handleEditTodo(todo)}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDeleteTodo(todo.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                ))}
                                </>
                            )}
                        </div>
                    </ScrollArea>
                    {completedTodos.length > 0 && (
                        <Collapsible className="border-t pt-2">
                            <div className="flex items-center justify-between">
                                 <CollapsibleTrigger asChild>
                                    <Button variant="ghost" className="flex items-center gap-2 text-sm font-semibold w-full justify-start p-2 -ml-2">
                                        <ChevronDown className="h-4 w-4 data-[state=open]:rotate-180" />
                                        Completed ({completedTodos.length})
                                    </Button>
                                </CollapsibleTrigger>
                                <Button variant="ghost" size="sm" onClick={handleClearCompleted}>Clear All</Button>
                            </div>
                            <CollapsibleContent>
                                 <ScrollArea className="h-[150px] mt-2 pr-4">
                                     <div className="space-y-2">
                                        {completedTodos.map(todo => (
                                             <div key={todo.id} className="flex items-start gap-3 p-2 rounded-md bg-muted/50 group">
                                                <Checkbox id={`todo-${todo.id}`} checked={todo.isCompleted} onCheckedChange={() => handleToggleTodoComplete(todo)} className="mt-1"/>
                                                <div className="flex-grow">
                                                     <p className={cn("text-sm", todo.isCompleted && "line-through text-muted-foreground")}>{todo.text}</p>
                                                </div>
                                            </div>
                                        ))}
                                     </div>
                                 </ScrollArea>
                            </CollapsibleContent>
                        </Collapsible>
                    )}
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
