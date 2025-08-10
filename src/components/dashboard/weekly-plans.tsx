
"use client";

import * as React from "react";
import type { Employee, CalendarEvent } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Loader2 } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import Link from "next/link";
import { format, isThisWeek, parseISO } from "date-fns";

interface WeeklyPlansProps {
  currentUser: Employee | null;
  events: CalendarEvent[];
}

export function WeeklyPlans({ currentUser, events }: WeeklyPlansProps) {
  const weeklyEvents = React.useMemo(() => {
    if (!currentUser || !events) return [];
    
    return events
      .filter(event => 
          event.attendees?.includes(currentUser.id) && 
          isThisWeek(parseISO(event.start), { weekStartsOn: 1 })
      )
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [currentUser, events]);

  if (!currentUser) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin"/></div>
  }

  return (
    <Card className="h-full flex flex-col shadow-none border-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Your Weekly Plans
        </CardTitle>
        <CardDescription>A summary of your scheduled events for this week.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4 flex flex-col min-h-0">
        <ScrollArea className="flex-grow pr-4 -mr-4">
          <div className="space-y-3">
            {weeklyEvents.length > 0 ? (
              weeklyEvents.map(event => (
                <Link href="/calendar" key={event.id} className="block p-3 rounded-md hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-sm">{event.title}</p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">{format(parseISO(event.start), 'EEE, MMM d')}</p>
                  </div>
                  {!event.allDay && (
                     <p className="text-xs text-muted-foreground">{format(parseISO(event.start), 'p')}</p>
                  )}
                  {event.description && <p className="text-xs text-muted-foreground truncate pt-1">{event.description}</p>}
                </Link>
              ))
            ) : (
              <div className="text-center text-muted-foreground pt-8">
                <p>No events scheduled for this week.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
