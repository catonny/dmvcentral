
"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Engagement, Client } from "@/lib/data";
import { GripVertical, Timer, CalendarPlus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";
import { Button } from "../ui/button";

interface EngagementListItemProps {
    engagement: Engagement;
    client?: Client;
    onLogTime: (engagement: Engagement) => void;
    onScheduleMeeting: (engagement: Engagement) => void;
}

export function EngagementListItem({ engagement, client, onLogTime, onScheduleMeeting }: EngagementListItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: engagement.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const isOverdue = isPast(new Date(engagement.dueDate)) && engagement.status !== 'Completed';

    const handleLogTimeClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onLogTime(engagement);
    }
    
    const handleScheduleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onScheduleMeeting(engagement);
    }

    return (
         <div ref={setNodeRef} style={style} {...attributes}>
            <div className="group flex items-center gap-2 rounded-md bg-background p-2 touch-none hover:bg-white/10">
                <div {...listeners} className="cursor-grab p-1">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                </div>
                <Link href={`/workflow/${engagement.id}`} className="flex-grow">
                    <p className="text-sm font-medium truncate group-hover:text-primary">{engagement.remarks}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{client?.Name || '...'}</span>
                        <span className={cn(isOverdue && "text-destructive font-semibold")}>
                            {format(new Date(engagement.dueDate), "dd MMM")}
                        </span>
                    </div>
                </Link>
                 <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleScheduleClick}>
                        <CalendarPlus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleLogTimeClick}>
                        <Timer className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
