
"use client";

import * as React from "react";
import { collection, onSnapshot, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { EngagementType, Task } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, GripVertical, Trash2, PlusCircle } from "lucide-react";
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


export default function WorkflowEditorPage() {
    const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);
    const [selectedType, setSelectedType] = React.useState<EngagementType | null>(null);
    const [tasks, setTasks] = React.useState<string[]>([]);
    const [newTask, setNewTask] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsub = onSnapshot(collection(db, "engagementTypes"), (snapshot) => {
            const types = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EngagementType));
            setEngagementTypes(types);
            setLoading(false);
        });
        return () => unsub();
    }, []);
    
    React.useEffect(() => {
        if (selectedType) {
            setTasks(selectedType.subTaskTitles || []);
        } else {
            setTasks([]);
        }
    }, [selectedType]);
    
    const handleSaveWorkflow = async () => {
        if (!selectedType) return;
        
        try {
            const typeRef = doc(db, "engagementTypes", selectedType.id);
            await updateDoc(typeRef, { subTaskTitles: tasks });
            toast({ title: "Success", description: `Workflow for "${selectedType.name}" updated successfully.` });
        } catch (error) {
            console.error("Error updating workflow:", error);
            toast({ title: "Error", description: "Failed to save workflow.", variant: "destructive" });
        }
    };
    
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setTasks((items) => {
                const oldIndex = items.findIndex(item => item === active.id);
                const newIndex = items.findIndex(item => item === over.id);
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
            <div>
                <h2 className="text-3xl font-bold tracking-tight font-headline">Workflow Editor</h2>
                <p className="text-muted-foreground">
                    Use this space to design reusable workflows for your engagements.
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Engagement Types</CardTitle>
                        <CardDescription>Select a type to edit its workflow.</CardDescription>
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
                         <CardTitle>
                            {selectedType ? `Editing: ${selectedType.name}` : "Select a Workflow"}
                        </CardTitle>
                        <CardDescription>
                            {selectedType ? "Drag to reorder, double-click to edit, and save your changes." : "Choose an engagement type from the left to begin."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {selectedType && (
                            <div className="space-y-4">
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-2">
                                            {tasks.map((task, index) => (
                                                <SortableTaskItem 
                                                    key={task}
                                                    id={task} 
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
                                    <Button onClick={handleSaveWorkflow}>Save Workflow</Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
