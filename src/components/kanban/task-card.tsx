
"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { Task, Client, Employee } from "@/lib/data";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  client?: Client;
  employee?: Employee;
  engagementRemarks?: string;
}

export function TaskCard({ task, client, employee, engagementRemarks }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className={cn("hover:shadow-primary/20 transition-shadow", isDragging && "opacity-50")}>
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-medium leading-tight">
            {task.title}
          </CardTitle>
           {engagementRemarks && <p className="text-xs text-muted-foreground pt-1">{engagementRemarks}</p>}
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">{client?.Name || "..."}</p>
            {employee && (
              <Avatar className="h-6 w-6">
                <AvatarImage src={employee.avatar} alt={employee.name} />
                <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
              </Avatar>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
