
"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Employee, Engagement, Client } from "@/lib/data";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { EngagementCard } from "./engagement-card";
import { cn } from "@/lib/utils";

interface EmployeeLaneProps {
    employee: Employee;
    engagements: Engagement[];
    clientMap: Map<string, Client>;
    employeeMap: Map<string, Employee>;
    onRemoveUser: (engagementId: string, userIdToRemove: string) => void;
}

export function EmployeeLane({ employee, engagements, clientMap, employeeMap, onRemoveUser }: EmployeeLaneProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: employee.id,
    });

    return (
        <div 
            ref={setNodeRef} 
            className={cn(
                "flex flex-col gap-4 p-4 rounded-lg bg-muted/30 transition-colors",
                isOver && "bg-primary/10"
            )}
        >
            <div className="flex items-center gap-3">
                <Avatar>
                    <AvatarImage src={employee.avatar} alt={employee.name} />
                    <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <h3 className="font-semibold text-foreground">{employee.name}</h3>
                    <p className="text-xs text-muted-foreground">{engagements.length} active engagement(s)</p>
                </div>
            </div>
            <div className="space-y-3 min-h-[100px]">
                <SortableContext items={engagements.map(e => e.id)} strategy={verticalListSortingStrategy}>
                    {engagements.map(engagement => (
                        <EngagementCard
                            key={engagement.id}
                            engagement={engagement}
                            client={clientMap.get(engagement.clientId)}
                            employeeMap={employeeMap}
                            onRemoveUser={onRemoveUser}
                        />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
}
