

"use client";

import * as React from "react";
import { collection, onSnapshot, doc, updateDoc, writeBatch, addDoc, deleteDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { EngagementType, SalesItem } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, GripVertical, Trash2, PlusCircle, ArrowLeft, Edit, Check, ChevronsUpDown } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useRouter } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { cn } from "@/lib/utils";


function SortableTaskItem({ id, title, onUpdate, onDelete }: { id: string; title: string; onUpdate: (newTitle: string) => void; onDelete: () => void; }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState(title);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleUpdate = () => {
    if (newTitle.trim()) {
        onUpdate(newTitle.trim());
        setIsEditing(false);
    }
  };
  
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-background p-2 rounded-lg">
      <div {...attributes} {...listeners} className="cursor-grab touch-none p-2">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      {isEditing ? (
        <Input 
            value={newTitle} 
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={handleUpdate}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
            autoFocus
            className="flex-grow"
        />
      ) : (
        <span onDoubleClick={() => setIsEditing(true)} className="flex-grow cursor-pointer">{title}</span>
      )}
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}


export function WorkflowEditor({ onBack }: { onBack: () => void }) {
    const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);
    const [salesItems, setSalesItems] = React.useState<SalesItem[]>([]);
    const [selectedType, setSelectedType] = React.useState<EngagementType | null>(null);
    const [tasks, setTasks] = React.useState<string[]>([]);
    const [newTask, setNewTask] = React.useState('');
    const [editingTypeName, setEditingTypeName] = React.useState('');
    const [editingDescription, setEditingDescription] = React.useState('');
    const [editingRecurrence, setEditingRecurrence] = React.useState<EngagementType['recurrence'] | ''>('');
    const [editingStandardHours, setEditingStandardHours] = React.useState<number | ''>('');
    const [typeToDelete, setTypeToDelete] = React.useState<EngagementType | null>(null);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();
    const router = useRouter();


    React.useEffect(() => {
        const unsubTypes = onSnapshot(collection(db, "engagementTypes"), (snapshot) => {
            const types = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EngagementType));
            setEngagementTypes(types.sort((a,b) => a.name.localeCompare(b.name)));
            setLoading(false);
        });

         const unsubSalesItems = onSnapshot(collection(db, "salesItems"), (snapshot) => {
            setSalesItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesItem)));
        });

        return () => {
            unsubTypes();
            unsubSalesItems();
        }
    }, []);
    
    React.useEffect(() => {
        if (selectedType) {
            setTasks(selectedType.subTaskTitles || []);
            setEditingTypeName(selectedType.name);
            setEditingDescription(selectedType.description || '');
            setEditingRecurrence(selectedType.recurrence || '');
            setEditingStandardHours(selectedType.standardHours || '');
        } else {
            setTasks([]);
            setEditingTypeName('');
            setEditingDescription('');
            setEditingRecurrence('');
            setEditingStandardHours('');
        }
    }, [selectedType]);
    
    const handleSaveChanges = async () => {
        if (!selectedType || !editingTypeName.trim()) {
            toast({ title: "Validation Error", description: "Engagement Type name cannot be empty.", variant: "destructive" });
            return;
        }
        
        try {
            const typeRef = doc(db, "engagementTypes", selectedType.id);
            await updateDoc(typeRef, { 
                name: editingTypeName.trim(),
                description: editingDescription,
                subTaskTitles: tasks,
                recurrence: editingRecurrence || null,
                standardHours: Number(editingStandardHours) || null,
            });
            toast({ title: "Success", description: `Workflow for "${editingTypeName}" updated successfully.` });
        } catch (error) {
            console.error("Error updating workflow:", error);
            toast({ title: "Error", description: "Failed to save workflow.", variant: "destructive" });
        }
    };

    const handleCreateNewType = async () => {
        const newTypeName = "New Engagement Type";
        try {
            const newDocRef = await addDoc(collection(db, "engagementTypes"), {
                name: newTypeName,
                description: "A new workflow template.",
                subTaskTitles: ["Task 1", "Task 2"]
            });
            await updateDoc(newDocRef, { id: newDocRef.id });
            const newType: EngagementType = { id: newDocRef.id, name: newTypeName, description: "A new workflow template.", subTaskTitles: ["Task 1", "Task 2"], recurrence: undefined };
            setSelectedType(newType);
            toast({ title: "Success", description: "New engagement type created." });
        } catch (error) {
            toast({ title: "Error", description: "Could not create new engagement type.", variant: "destructive"});
        }
    };
    
    const handleDeleteType = async () => {
        if (!typeToDelete) return;
        
        const q = query(collection(db, "engagements"), where("type", "==", typeToDelete.id));
        const usageSnapshot = await getDocs(q);
        if (!usageSnapshot.empty) {
            toast({ title: "Action Blocked", description: `Cannot delete "${typeToDelete.name}" as it is being used by ${usageSnapshot.size} engagement(s).`, variant: "destructive" });
            setTypeToDelete(null);
            return;
        }

        try {
            await deleteDoc(doc(db, "engagementTypes", typeToDelete.id));
            toast({ title: "Success", description: `"${typeToDelete.name}" was deleted.`});
            if(selectedType?.id === typeToDelete.id) {
                setSelectedType(null);
            }
        } catch (error) {
            toast({ title: "Error", description: "Could not delete engagement type.", variant: "destructive"});
        } finally {
            setTypeToDelete(null);
        }
    }
    
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setTasks((items) => {
                const oldIndex = items.findIndex(item => (item + items.indexOf(item)) === active.id);
                const newIndex = items.findIndex(item => (item + items.indexOf(item)) === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };
    
     const handleUpdateTask = (index: number, newTitle: string) => {
        setTasks(currentTasks => {
            const newTasks = [...currentTasks];
            newTasks[index] = newTitle;
            return newTasks;
        });
    };
    
    const handleDeleteTask = (index: number) => {
        setTasks(currentTasks => currentTasks.filter((_, i) => i !== index));
    };

    const handleAddTask = () => {
        if (newTask.trim()) {
            setTasks(currentTasks => [...currentTasks, newTask.trim()]);
            setNewTask('');
        }
    };
    
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
        })
    );


    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
             <Button variant="outline" size="sm" onClick={() => router.push('/masters')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Masters
            </Button>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Engagement Types</CardTitle>
                            <CardDescription>Select a type to edit.</CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleCreateNewType}>
                            <PlusCircle />
                        </Button>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {engagementTypes.map(type => (
                            <Button 
                                key={type.id} 
                                variant={selectedType?.id === type.id ? "secondary" : "ghost"}
                                onClick={() => setSelectedType(type)}
                                className="w-full justify-start"
                            >
                                {type.name}
                            </Button>
                        ))}
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                         <div className="flex justify-between items-start">
                             <div>
                                <CardTitle className="flex items-center gap-2">
                                    {selectedType ? "Edit Workflow" : "Select a Workflow"}
                                </CardTitle>
                                <CardDescription>
                                    {selectedType ? `Editing workflow for "${selectedType.name}"` : "Choose an engagement type from the left to begin."}
                                </CardDescription>
                             </div>
                             {selectedType && (
                                <Button variant="destructive" size="sm" onClick={() => setTypeToDelete(selectedType)}>
                                    <Trash2 className="mr-2 h-4 w-4"/>
                                    Delete Type
                                </Button>
                             )}
                         </div>
                    </CardHeader>
                    <CardContent>
                        {selectedType && (
                            <div className="space-y-4">
                                
                                <div className="space-y-2">
                                    <Label htmlFor="typeName">Engagement Type Name</Label>
                                    <Input id="typeName" value={editingTypeName} onChange={(e) => setEditingTypeName(e.target.value)} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="typeDescription">Description</Label>
                                    <Textarea id="typeDescription" value={editingDescription} onChange={(e) => setEditingDescription(e.target.value)} placeholder="Describe what this engagement type is for." />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="typeRecurrence">Recurrence</Label>
                                        <Select value={editingRecurrence} onValueChange={(value) => setEditingRecurrence(value as EngagementType['recurrence'])}>
                                            <SelectTrigger id="typeRecurrence">
                                                <SelectValue placeholder="No Recurrence" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value=" ">No Recurrence</SelectItem>
                                                <SelectItem value="Monthly">Monthly</SelectItem>
                                                <SelectItem value="Quarterly">Quarterly</SelectItem>
                                                <SelectItem value="Yearly">Yearly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="standardHours">Standard Hours</Label>
                                        <Input id="standardHours" type="number" value={editingStandardHours} onChange={(e) => setEditingStandardHours(Number(e.target.value))} placeholder="e.g., 40" />
                                    </div>
                                </div>
                                                                
                                <h4 className="font-semibold text-foreground pt-4 border-t">Task Checklist</h4>
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={tasks.map((task, index) => task + index)} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-2">
                                            {tasks.map((task, index) => (
                                                <SortableTaskItem 
                                                    key={task + index}
                                                    id={task + index} 
                                                    title={task}
                                                    onUpdate={(newTitle) => handleUpdateTask(index, newTitle)}
                                                    onDelete={() => handleDeleteTask(index)}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                                <div className="flex gap-2 pt-4 border-t">
                                    <Input 
                                        placeholder="Add new task..."
                                        value={newTask}
                                        onChange={(e) => setNewTask(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                                    />
                                    <Button onClick={handleAddTask}>
                                        <PlusCircle />
                                        Add Task
                                    </Button>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button onClick={handleSaveChanges}>Save Changes</Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
             <AlertDialog open={!!typeToDelete} onOpenChange={(open) => !open && setTypeToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the engagement type <strong>{typeToDelete?.name}</strong>. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteType} className="bg-destructive hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
