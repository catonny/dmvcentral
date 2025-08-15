
"use client";

import * as React from "react";
import type { ChatMessage, Employee } from "@/lib/data";
import { cn } from "@/lib/utils";
import { format, isSameDay, parseISO } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatMessageBubbleProps {
    message: ChatMessage;
    currentUser: Employee;
    allEmployees: Employee[];
}

export function ChatMessageBubble({ message, currentUser, allEmployees }: ChatMessageBubbleProps) {
    const isCurrentUser = message.senderId === currentUser.id;
    const sender = allEmployees.find(e => e.id === message.senderId);

    const formattedTime = (timestamp: string) => {
        const date = parseISO(timestamp);
        if (isSameDay(date, new Date())) {
            return format(date, 'p');
        }
        return format(date, 'MMM d, p');
    };

    return (
        <div className={cn(
            "flex items-end gap-2",
            isCurrentUser ? "justify-end" : "justify-start"
        )}>
            {!isCurrentUser && (
                <Avatar className="h-8 w-8">
                    <AvatarImage src={sender?.avatar} alt={sender?.name} />
                    <AvatarFallback>{sender?.name.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
            )}
            <div className={cn(
                "max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg",
                isCurrentUser 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted"
            )}>
                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                 <p className={cn(
                     "text-xs mt-1",
                     isCurrentUser ? "text-primary-foreground/70" : "text-muted-foreground"
                 )}>
                    {formattedTime(message.timestamp)}
                </p>
            </div>
             {isCurrentUser && (
                <Avatar className="h-8 w-8">
                    <AvatarImage src={currentUser?.avatar} alt={currentUser?.name} />
                    <AvatarFallback>{currentUser?.name.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
            )}
        </div>
    );
}
