
"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Employee, Engagement, Client } from "@/lib/data";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { cn } from "@/lib/utils";
import { EngagementListItem } from "./engagement-list-item";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

interface EmployeeLaneProps {
    employee: Employee;
    engagements: Engagement[];
    clientMap: Map<string, Client>;
    onScheduleMeeting: (engagement: Engagement) => void;
}

export function EmployeeLane({ employee, engagements, clientMap, onScheduleMeeting }: EmployeeLaneProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: employee.id,
    });
    const [isOpen, setIsOpen] = React.useState(false);


    return (
        <div 
            ref={setNodeRef}
            className={cn(
                "flex flex-col gap-3 p-3 rounded-lg bg-muted/30 transition-colors h-full",
                isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}
        >
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            <CollapsibleTrigger asChild>
                 <div className="flex items-center gap-3 flex-shrink-0 cursor-pointer group">
                    <Avatar>
                        <AvatarImage src={employee.avatar} alt={employee.name} />
                        <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-grow">
                        <h3 className="font-semibold text-foreground">{employee.name}</h3>
                        <p className="text-xs text-muted-foreground">{engagements.length} active engagement(s)</p>
                    </div>
                    <ChevronRight className={cn("h-5 w-5 text-muted-foreground transition-transform group-hover:text-foreground", isOpen && "rotate-90")} />
                </div>
            </CollapsibleTrigger>
             <CollapsibleContent>
                <div className="space-y-2 min-h-[80px] flex-grow mt-3">
                    <SortableContext items={engagements.map(e => e.id)} strategy={verticalListSortingStrategy}>
                        {engagements.map(engagement => (
                            <EngagementListItem
                                key={engagement.id}
                                engagement={engagement}
                                client={clientMap.get(engagement.clientId)}
                            />
                        ))}
                    </SortableContext>
                </div>
             </CollapsibleContent>
        </Collapsible>
        </div>
    );
}
