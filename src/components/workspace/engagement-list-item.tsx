
"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Engagement, Client } from "@/lib/data";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";

interface EngagementListItemProps {
    engagement: Engagement;
    client?: Client;
}

export function EngagementListItem({ engagement, client }: EngagementListItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: engagement.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const isOverdue = isPast(new Date(engagement.dueDate)) && engagement.status !== 'Completed';

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
            </div>
        </div>
    );
}
