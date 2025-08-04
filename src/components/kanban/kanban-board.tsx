
"use client";

import * as React from "react";
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Task, Client, Employee, TaskStatus, Engagement } from "@/lib/data";
import { KanbanColumn } from "./kanban-column";

const KANBAN_STAGES: TaskStatus[] = ["Pending", "Completed", "Cancelled"];

export function KanbanBoard({ tasks, clients, employees, engagements }: { tasks: Task[], clients: Client[], employees: Employee[], engagements: Engagement[] }) {
  const { toast } = useToast();
  const [taskState, setTaskState] = React.useState(tasks);
  
  React.useEffect(() => {
    setTaskState(tasks);
  }, [tasks]);

  const clientMap = React.useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const employeeMap = React.useMemo(() => new Map(employees.map(s => [s.id, s])), [employees]);
  const engagementMap = React.useMemo(() => new Map(engagements.map(e => [e.id, e])), [engagements]);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStage = over.data.current?.sortable?.containerId as TaskStatus || over.id as TaskStatus;
    
    if (active.id === over.id || !newStage || !KANBAN_STAGES.includes(newStage)) return;

    const taskToMove = taskState.find(t => t.id === taskId);
    if (taskToMove && taskToMove.status !== newStage) {
      // Optimistic UI update
      setTaskState(prev => prev.map(t => t.id === taskId ? { ...t, status: newStage } : t));

      try {
        const batch = writeBatch(db);
        const taskRef = doc(db, "tasks", taskId);
        batch.update(taskRef, { status: newStage });
        await batch.commit();

        toast({
          title: "Task Updated",
          description: `Moved "${taskToMove.title}" to ${newStage}.`,
        });
      } catch (error) {
        console.error("Error updating task stage:", error);
        // Revert on failure
        setTaskState(tasks);
        toast({
          title: "Update Failed",
          description: "Could not update the task's stage.",
          variant: "destructive",
        });
      }
    }
  };

  const columns = KANBAN_STAGES.map(stage => {
    let stageTasks: Task[];
    if (stage === "Pending") {
      // Any task that is not explicitly 'Completed' or 'Cancelled' is considered 'Pending'
      stageTasks = taskState.filter(task => task.status !== "Completed" && task.status !== "Cancelled");
    } else {
      stageTasks = taskState.filter(task => task.status === stage);
    }
    return {
      id: stage,
      title: stage,
      tasks: stageTasks,
    };
  });

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 h-full">
        {columns.map(col => (
          <KanbanColumn key={col.id} id={col.id} title={col.title} tasks={col.tasks} clientMap={clientMap} employeeMap={employeeMap} engagementMap={engagementMap} />
        ))}
      </div>
    </DndContext>
  );
}
