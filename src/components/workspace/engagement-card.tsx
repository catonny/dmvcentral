
"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Engagement, Client, Employee } from "@/lib/data";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { XIcon } from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface EngagementCardProps {
    engagement: Engagement;
    client?: Client;
    employeeMap: Map<string, Employee>;
    onRemoveUser: (engagementId: string, userIdToRemove: string) => void;
}

export function EngagementCard({ engagement, client, employeeMap, onRemoveUser }: EngagementCardProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: engagement.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <Card ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none bg-background hover:shadow-md">
            <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm font-semibold leading-tight">{engagement.remarks}</CardTitle>
                 <CardDescription className="text-xs">
                    Client: 
                     <Button variant="link" asChild className="p-0 h-auto font-normal text-xs ml-1">
                        <Link href={`/workspace/${engagement.clientId}`}>
                            {client?.Name || "..."}
                        </Link>
                    </Button>
                </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
                 <div className="flex items-center -space-x-2">
                    <TooltipProvider>
                        {engagement.assignedTo.map(id => {
                            const employee = employeeMap.get(id);
                            if (!employee) return null;
                            return (
                                <Tooltip key={id}>
                                    <TooltipTrigger asChild>
                                         <div className="relative group">
                                            <Avatar className="h-7 w-7 border-2 border-background">
                                                <AvatarImage src={employee.avatar} alt={employee.name} />
                                                <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation(); // prevent dnd listeners from firing
                                                    onRemoveUser(engagement.id, id);
                                                }}
                                                className="absolute -top-1 -right-1 z-10 h-4 w-4 bg-muted-foreground text-background rounded-full items-center justify-center opacity-0 group-hover:opacity-100 hidden group-hover:flex transition-opacity"
                                            >
                                                <XIcon className="h-3 w-3" />
                                            </button>
                                         </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{employee.name}</p>
                                    </TooltipContent>
                                </Tooltip>
                            )
                        })}
                    </TooltipProvider>
                </div>
            </CardContent>
        </Card>
    );
}
