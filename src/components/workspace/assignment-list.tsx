
"use client";

import * as React from "react";
import type { Client, Engagement, EngagementType, Employee, Department, Task, TaskStatus } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { doc, updateDoc, collection, getDocs, query, addDoc, where, writeBatch, serverTimestamp, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { EditableDueDate } from "./editable-due-date";
import { Button } from "../ui/button";
import { Check, ChevronDown, PlusCircle } from "lucide-react";
import { AddTaskDialog } from "./add-task-dialog";
import { useAuth } from "@/hooks/use-auth";
import { EditableStatus } from "./editable-status";
import { EditableClient } from "./editable-client";
import { EditableEngagementType } from "./editable-engagement-type";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Checkbox } from "../ui/checkbox";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { Textarea } from "../ui/textarea";
import { useDebounce } from "@/hooks/use-debounce";
import Link from "next/link";

interface AssignmentListProps {
    engagements: Engagement[];
    clientMap: Map<string, Client>;
    currentUserEmployee: Employee | null;
}

function EngagementNotes({ engagement, onNotesChange }: { engagement: Engagement, onNotesChange: (engagementId: string, notes: string) => void }) {
    const [notes, setNotes] = React.useState(engagement.notes || "");
    const debouncedNotes = useDebounce(notes, 500);

    React.useEffect(() => {
        setNotes(engagement.notes || "");
    }, [engagement.notes]);

    React.useEffect(() => {
        if (debouncedNotes !== engagement.notes) {
            onNotesChange(engagement.id, debouncedNotes);
        }
    }, [debouncedNotes, engagement.id, engagement.notes, onNotesChange]);

    return (
        <Textarea
            placeholder="Add notes for this engagement..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-2"
        />
    );
}

export function AssignmentList({ engagements, clientMap, currentUserEmployee }: AssignmentListProps) {
    const { toast } = useToast();
    const [tasks, setTasks] = React.useState<Task[]>([]);
    const [allClients, setAllClients] = React.useState<Client[]>([]);
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
    const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);
    const [departments, setDepartments] = React.useState<Department[]>([]);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [openCollapsibleId, setOpenCollapsibleId] = React.useState<string | null>(null);

    React.useEffect(() => {
        const tasksUnsub = onSnapshot(collection(db, "tasks"), (snapshot) => {
            const allTasksData = snapshot.docs.map(doc => doc.data() as Task);
            const relevantEngagementIds = new Set(engagements.map(e => e.id));
            const relevantTasks = allTasksData.filter(t => relevantEngagementIds.has(t.engagementId));
            setTasks(relevantTasks);
        }, (error) => console.error("Error fetching tasks:", error));

        return () => tasksUnsub();
    }, [engagements]);
    
    React.useEffect(() => {
        const clientsQuery = query(collection(db, "clients"));
        const engagementTypesQuery = query(collection(db, "engagementTypes"));
        const employeeQuery = query(collection(db, "employees"));
        const deptsQuery = query(collection(db, "departments"));

        const unsubClients = onSnapshot(clientsQuery, (snapshot) => {
            setAllClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        }, (error) => console.error("Error fetching clients:", error));

        const unsubEngagementTypes = onSnapshot(engagementTypesQuery, (snapshot) => {
            setEngagementTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EngagementType)));
        }, (error) => console.error("Error fetching engagement types:", error));

        const unsubEmployees = onSnapshot(employeeQuery, (snapshot) => {
            setAllEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
        }, (error) => console.error("Error fetching employees:", error));
        
        const unsubDepts = onSnapshot(deptsQuery, (snapshot) => {
            setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
        }, (error) => console.error("Error fetching departments:", error));

        return () => {
            unsubClients();
            unsubEngagementTypes();
            unsubEmployees();
            unsubDepts();
        }
    }, []);
    
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
    
    const handleEngagementTypeChange = async (engagementId: string, newTypeId: string, newTypeName: string) => {
        await updateEngagementField(engagementId, 'type', newTypeId, `Engagement type has been updated to ${newTypeName}.`);
    };

    const handleDueDateChange = (engagementId: string, newDueDate: Date) => {
       updateEngagementField(engagementId, 'dueDate', newDueDate.toISOString(), `Engagement due date has been changed to ${newDueDate.toLocaleDateString()}`);
    };

    const handleStatusChange = async (engagementId: string, newStatus: EngagementStatus, submitToBilling?: boolean) => {
        const engagementRef = doc(db, "engagements", engagementId);
        try {
            const updatePayload: Partial<Engagement> = { status: newStatus };
            if (submitToBilling) {
                updatePayload.billStatus = "To Bill";
                updatePayload.billSubmissionDate = new Date().toISOString();
            }
            await updateDoc(engagementRef, updatePayload);
            toast({
                title: "Success",
                description: `Engagement status changed to ${newStatus}. ${submitToBilling ? 'Submitted for billing.' : ''}`,
            });
        } catch (error) {
            console.error(`Error updating status:`, error);
            toast({
                title: "Error",
                description: `Failed to update the status.`,
                variant: "destructive",
            });
        }
    };
    
    const handleClientChange = (engagementId: string, newClientId: string) => {
        const clientName = allClients.find(c => c.id === newClientId)?.Name || 'the new client';
        updateEngagementField(engagementId, 'clientId', newClientId, `Engagement has been reassigned to ${clientName}.`);
    };

    const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
        const taskRef = doc(db, "tasks", taskId);
        try {
            await updateDoc(taskRef, { status: newStatus });
            setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? {...t, status: newStatus} : t));
        } catch (error) {
             console.error(`Error updating task status:`, error);
            toast({ title: "Error", description: `Failed to update task status.`, variant: "destructive" });
        }
    };

    const handleNotesChange = (engagementId: string, notes: string) => {
        updateEngagementField(engagementId, 'notes', notes); // No toast for auto-save
    };

    const handleAddTask = async (data: any, client?: Client, reporterId?: string) => {
        if (!currentUserEmployee) {
             toast({ title: "Error", description: "Could not identify current user.", variant: "destructive" });
             return;
        }
        try {
            const batch = writeBatch(db);
            let engagementTypeId = data.type;
            const engagementTypeIsExisting = engagementTypes.some(et => et.id === engagementTypeId);

            // Handle new template creation
            if (data.saveAsTemplate && data.templateName && !engagementTypeIsExisting) {
                const newTypeRef = doc(collection(db, 'engagementTypes'));
                engagementTypeId = newTypeRef.id;
                const newEngagementType: EngagementType = {
                    id: newTypeRef.id,
                    name: data.templateName,
                    description: data.remarks.substring(0, 100), // Use part of remarks as description
                    subTaskTitles: ["Task 1", "Task 2", "Task 3"] // Default tasks
                };
                batch.set(newTypeRef, newEngagementType);
                toast({ title: "Template Created", description: `New workflow template "${data.templateName}" was created.` });
            }

            const newEngagementDocRef = doc(collection(db, 'engagements'));
            const newEngagementData: Engagement = {
                id: newEngagementDocRef.id,
                remarks: data.remarks,
                clientId: data.clientId,
                type: engagementTypeId,
                assignedTo: [currentUserEmployee.id],
                reportedTo: reporterId || "", 
                status: 'Pending',
                dueDate: data.dueDate.toISOString()
            };
            batch.set(newEngagementDocRef, newEngagementData);
            
            const engagementType = engagementTypes.find(et => et.id === engagementTypeId);
            const subTaskTitles = engagementType?.subTaskTitles || (data.saveAsTemplate ? ["Task 1", "Task 2", "Task 3"] : []);
            
            subTaskTitles.forEach((title, index) => {
                const taskDocRef = doc(collection(db, 'tasks'));
                const newTask: Task = {
                    id: taskDocRef.id,
                    engagementId: newEngagementDocRef.id,
                    title,
                    status: 'Pending',
                    order: index + 1,
                    assignedTo: currentUserEmployee.id,
                };
                batch.set(taskDocRef, newTask);
            });

            await batch.commit();
            
            toast({ title: "Engagement Added", description: `New engagement and its tasks have been created.` });
            setIsDialogOpen(false);
        } catch (error) {
            console.error("Error adding engagement:", error);
            toast({ title: "Error", description: "Failed to add the new engagement.", variant: "destructive" });
        }
    };


    const sortedEngagements = React.useMemo(() => {
        return [...engagements].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [engagements]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Your Assignments</CardTitle>
                    <CardDescription>
                        Engagements assigned to you, sorted by the nearest due date.
                    </CardDescription>
                </div>
                <Button onClick={() => setIsDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Engagement
                </Button>
            </CardHeader>
            <CardContent>
                <ScrollArea className="w-full whitespace-nowrap">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>Engagement (Remarks)</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Due Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        {sortedEngagements.length > 0 ? (
                            sortedEngagements.map((eng) => {
                                const client = clientMap.get(eng.clientId);
                                const engagementType = engagementTypes.find(et => et.id === eng.type);
                                const isOpen = openCollapsibleId === eng.id;
                                const engagementTasks = tasks
                                    .filter(t => t.engagementId === eng.id)
                                    .sort((a, b) => a.order - b.order);

                                return (
                                    <Collapsible asChild key={eng.id} open={isOpen} onOpenChange={() => setOpenCollapsibleId(isOpen ? null : eng.id)}>
                                         <TableBody>
                                            <TableRow className="text-sm border-b">
                                                <TableCell>
                                                    <CollapsibleTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                                                        </Button>
                                                    </CollapsibleTrigger>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    <EditableEngagementType
                                                        engagement={eng}
                                                        allEngagementTypes={engagementTypes}
                                                        onEngagementTypeChange={handleEngagementTypeChange}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="link" asChild className="p-0 h-auto font-normal">
                                                        <Link href={`/workspace/${eng.clientId}`}>
                                                            {client?.Name || "..."}
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                                <TableCell>
                                                    <EditableStatus 
                                                        engagement={eng}
                                                        client={client}
                                                        engagementType={engagementType}
                                                        onStatusChange={handleStatusChange}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <EditableDueDate
                                                        engagement={eng}
                                                        onDueDateChange={handleDueDateChange}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                            <CollapsibleContent asChild>
                                                <tr>
                                                    <td colSpan={5} className="p-0">
                                                        <div className="p-4 bg-muted/50 grid grid-cols-2 gap-6">
                                                            <div>
                                                                <h4 className="font-semibold mb-2 text-sm">Tasks</h4>
                                                                <div className="space-y-2">
                                                                    {engagementTasks.map(task => (
                                                                        <div key={task.id} className="flex items-center space-x-2">
                                                                            <Checkbox
                                                                                id={`task-${task.id}`}
                                                                                checked={task.status === 'Completed'}
                                                                                onCheckedChange={(checked) => {
                                                                                    const newStatus = checked ? 'Completed' : 'Pending';
                                                                                    handleTaskStatusChange(task.id, newStatus);
                                                                                }}
                                                                            />
                                                                            <label
                                                                                htmlFor={`task-${task.id}`}
                                                                                className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", task.status === 'Completed' && 'line-through text-muted-foreground')}
                                                                            >
                                                                                {task.title}
                                                                            </label>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                             <div>
                                                                <h4 className="font-semibold mb-2 text-sm">Notes</h4>
                                                                <EngagementNotes engagement={eng} onNotesChange={handleNotesChange} />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </CollapsibleContent>
                                        </TableBody>
                                    </Collapsible>
                                );
                            })
                        ) : (
                             <TableBody>
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">
                                        You have no assigned engagements.
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        )}
                    </Table>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
            <AddTaskDialog 
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                onSave={handleAddTask}
                clients={allClients}
                engagementTypes={engagementTypes}
                allEmployees={allEmployees}
                departments={departments}
                currentUserEmployee={currentUserEmployee}
            />
        </Card>
    );
}
