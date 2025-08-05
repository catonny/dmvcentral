
"use client";

import * as React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { CalendarEvent, Employee } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { EventDialog } from "@/components/calendar/event-dialog";

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedEventInfo, setSelectedEventInfo] = React.useState<any>(null);

  React.useEffect(() => {
    const unsubEvents = onSnapshot(collection(db, "events"), (snapshot) => {
      const fetchedEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent));
      setEvents(fetchedEvents);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching events:", error);
      toast({ title: "Error", description: "Could not fetch calendar events.", variant: "destructive" });
      setLoading(false);
    });

    const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
        setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)))
    });

    return () => {
        unsubEvents();
        unsubEmployees();
    };
  }, [toast]);

  const handleDateClick = (arg: any) => {
    setSelectedEventInfo({
      startStr: arg.dateStr,
      endStr: arg.dateStr,
      allDay: arg.allDay,
    });
    setIsDialogOpen(true);
  };

  const handleEventClick = (arg: any) => {
    const event = events.find(e => e.id === arg.event.id);
    if (event) {
        setSelectedEventInfo(event);
        setIsDialogOpen(true);
    }
  };

  const handleEventChange = async (arg: any) => {
    const { event } = arg;
    const eventRef = doc(db, "events", event.id);
    try {
        await updateDoc(eventRef, {
            start: event.start.toISOString(),
            end: event.end ? event.end.toISOString() : event.start.toISOString(),
            allDay: event.allDay,
        });
        toast({ title: "Success", description: "Event updated successfully." });
    } catch (error) {
        console.error("Error updating event:", error);
        toast({ title: "Error", description: "Failed to update event.", variant: "destructive" });
        arg.revert();
    }
  }

  const handleSaveEvent = async (eventData: Partial<CalendarEvent>) => {
    if (!user) {
        toast({ title: "Error", description: "You must be logged in to save events.", variant: "destructive" });
        return;
    }

    try {
        if (eventData.id) { // Update existing event
            const eventRef = doc(db, "events", eventData.id);
            await updateDoc(eventRef, eventData);
            toast({ title: "Success", description: "Event updated." });
        } else { // Create new event
            await addDoc(collection(db, "events"), {
                ...eventData,
                createdBy: user.uid,
            });
            toast({ title: "Success", description: "Event created." });
        }
        setIsDialogOpen(false);
        setSelectedEventInfo(null);
    } catch (error) {
        console.error("Error saving event:", error);
        toast({ title: "Error", description: "Failed to save event.", variant: "destructive" });
    }
  };
  
  const handleDeleteEvent = async (eventId: string) => {
    try {
        await deleteDoc(doc(db, "events", eventId));
        toast({ title: "Success", description: "Event deleted." });
        setIsDialogOpen(false);
        setSelectedEventInfo(null);
    } catch (error) {
        console.error("Error deleting event:", error);
        toast({ title: "Error", description: "Failed to delete event.", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[85vh] flex flex-col">
       <div className="flex items-center justify-between space-y-2 mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Team Calendar</h2>
          <p className="text-muted-foreground">
            View and manage shared events, deadlines, and meetings for the team.
          </p>
        </div>
      </div>
      <div className="flex-grow">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          initialView="dayGridMonth"
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          events={events}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventChange={handleEventChange}
          eventDrop={handleEventChange}
          eventResize={handleEventChange}
        />
      </div>
       <EventDialog
        isOpen={isDialogOpen}
        onClose={() => {
            setIsDialogOpen(false);
            setSelectedEventInfo(null);
        }}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        eventInfo={selectedEventInfo}
        employees={employees}
        currentUser={user}
      />
    </div>
  );
}
