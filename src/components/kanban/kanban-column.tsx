
"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Task, Client, Employee, Engagement } from "@/lib/data";
import { TaskCard } from "./task-card";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  clientMap: Map<string, Client>;
  employeeMap: Map<string, Employee>;
  engagementMap: Map<string, Engagement>;
}

export function KanbanColumn({ id, title, tasks, clientMap, employeeMap, engagementMap }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 bg-muted/50 rounded-t-lg border-b border-white/10">
        <h3 className="font-semibold text-foreground">
          {title} <span className="text-sm text-muted-foreground">({tasks.length})</span>
        </h3>
      </div>
      <ScrollArea
        ref={setNodeRef}
        className={cn(
            "bg-muted/50 rounded-b-lg p-3 flex-grow transition-colors",
            isOver ? "bg-white/10" : ""
        )}
      >
        <SortableContext id={id} items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {tasks.map(task => {
                const engagement = engagementMap.get(task.engagementId);
                const employee = task.assignedTo ? employeeMap.get(task.assignedTo) : undefined;
                const client = engagement ? clientMap.get(engagement.clientId) : undefined;
                return (
                    <TaskCard key={task.id} task={task} client={client} employee={employee} engagementRemarks={engagement?.remarks} />
                )
            })}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}
