
"use client";

import * as React from "react";
import type { Client, Employee, Todo } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Check, Loader2, PlusCircle, Send, User } from "lucide-react";
import { collection, onSnapshot, query, where, getDocs, writeBatch, doc, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { ScrollArea } from "../ui/scroll-area";

export function TodoSection({ currentUser, allClients, allEmployees }: { currentUser: Employee | null, allClients: Client[], allEmployees: Employee[] }) {
    const [todos, setTodos] = React.useState<Todo[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isAdding, setIsAdding] = React.useState(false);
    const [newTodoText, setNewTodoText] = React.useState("");
    const { toast } = useToast();

    React.useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const todosQuery = query(collection(db, "todos"), where("assignedTo", "array-contains", currentUser.id), where("isCompleted", "==", false));
        const unsubTodos = onSnapshot(todosQuery, (snap) => {
            const fetchedTodos = snap.docs.map(doc => doc.data() as Todo);
            
            const incompleteClientTodos: Todo[] = allClients
                .filter(c => c.pan === 'PANNOTAVLBL' || c.mailId === 'unassigned' || c.mobileNumber === '1111111111')
                .filter(c => c.partnerId === currentUser.id)
                .map(c => ({
                    id: `client-${c.id}`,
                    type: 'INCOMPLETE_CLIENT_DATA',
                    text: `Client "${c.Name}" has missing mandatory data (PAN, email, or mobile).`,
                    createdBy: 'system',
                    assignedTo: [c.partnerId],
                    relatedEntity: { type: 'client', id: c.id },
                    isCompleted: false,
                    createdAt: new Date().toISOString(),
                }));
            
            const combined = [...fetchedTodos, ...incompleteClientTodos].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setTodos(combined);
            setLoading(false);
        });

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

    if (loading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div>
    }

    return (
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
                <ScrollArea className="flex-grow">
                    <div className="space-y-2 pr-4">
                        {todos.length > 0 ? todos.map(todo => (
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
                        )) : (
                            <div className="text-center text-muted-foreground pt-8">
                                <p className="text-lg font-semibold">All Caught Up!</p>
                                <p>No pending actions required.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
