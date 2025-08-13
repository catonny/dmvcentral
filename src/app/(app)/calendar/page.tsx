
"use client";

import * as React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, query, where, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { CalendarEvent, Employee } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw } from "lucide-react";
import { EventDialog } from "@/components/calendar/event-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";

// Abridged list of IANA timezones for the selector
const timezones = [
    "UTC",
    "Asia/Kolkata",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Australia/Sydney"
];

// Helper to check for "google" scope
async function hasGoogleCalendarScope() {
    const user = auth.currentUser;
    if (!user) return false;

    // This is a simplified check. In a real app, you'd inspect the OAuth access token.
    // For this environment, we'll assume if they can get a provider data, they have some scope.
    // A more robust check is needed for production.
    const googleProvider = user.providerData.find(p => p.providerId === GoogleAuthProvider.PROVIDER_ID);
    return !!googleProvider;
}

// A simplified, client-side fetch for Google Calendar events
async function fetchGoogleCalendarEvents(currentUser: Employee) {
    if (!currentUser) throw new Error("Not signed in");

    // Re-authenticate with Google to ensure we have the necessary permissions
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/calendar.readonly");
    
    try {
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (!credential?.accessToken) {
            throw new Error("Could not get access token.");
        }
        const accessToken = credential.accessToken;
        
        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error.message || "Failed to fetch Google Calendar events.");
        }

        const data = await response.json();
        
        return data.items.map((item: any): Partial<CalendarEvent> => ({
            id: `gcal-${item.id}`, // Unique ID for our system
            title: item.summary,
            start: item.start.dateTime || item.start.date,
            end: item.end.dateTime || item.end.date,
            allDay: !item.start.dateTime,
            description: item.description || '',
            location: item.location || '',
            attendees: [currentUser.id], // Assign to current user
            createdBy: 'google_sync',
            timezone: item.start.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        }));

    } catch (error) {
        console.error("Error fetching Google Calendar events:", error);
        throw error;
    }
}


export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [currentUserEmployee, setCurrentUserEmployee] = React.useState<Employee | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [selectedEventInfo, setSelectedEventInfo] = React.useState<any>(null);
  const [view, setView] = React.useState("personal");

  React.useEffect(() => {
    if (user) {
        const q = query(collection(db, "employees"), where("email", "==", user.email));
        getDocs(q).then(snapshot => {
            if (!snapshot.empty) {
                setCurrentUserEmployee({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Employee);
            }
        });
    }
  }, [user]);

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
  
  const filteredEvents = React.useMemo(() => {
      if (view === 'team') {
          return events;
      }
      if (view === 'personal' && currentUserEmployee) {
          return events.filter(event => event.attendees?.includes(currentUserEmployee.id));
      }
      return [];
  }, [view, events, currentUserEmployee]);


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
    if (event.id.startsWith('gcal-')) {
        toast({ title: "Read Only", description: "Google Calendar events cannot be moved within this app.", variant: "destructive"});
        arg.revert();
        return;
    }
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
  
  const cleanUndefinedFields = (obj: any) => {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        newObj[key] = obj[key];
      }
    });
    return newObj;
  };

  const handleSaveEvent = async (eventData: Partial<CalendarEvent>) => {
    if (!user || !currentUserEmployee) {
        toast({ title: "Error", description: "You must be logged in to save events.", variant: "destructive" });
        return;
    }

    try {
        const cleanData = cleanUndefinedFields(eventData);

        if (cleanData.id) { // Update existing event
            const eventRef = doc(db, "events", cleanData.id);
            await updateDoc(eventRef, cleanData);
            toast({ title: "Success", description: "Event updated." });
        } else { // Create new event
            const newEventRef = doc(collection(db, "events"));
            await setDoc(newEventRef, {
                ...cleanData,
                id: newEventRef.id,
                createdBy: currentUserEmployee.id,
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

  const handleSyncGoogleCalendar = async () => {
    if (!currentUserEmployee) return;
    setIsSyncing(true);
    try {
        const gcalEvents = await fetchGoogleCalendarEvents(currentUserEmployee);
        
        const batch = writeBatch(db);
        let newEventsCount = 0;
        
        // Get existing event IDs to prevent duplicates
        const existingEventIds = new Set(events.map(e => e.id));

        gcalEvents.forEach(gcalEvent => {
            if (gcalEvent.id && !existingEventIds.has(gcalEvent.id)) {
                const eventRef = doc(db, "events", gcalEvent.id);
                batch.set(eventRef, gcalEvent);
                newEventsCount++;
            }
        });
        
        if (newEventsCount > 0) {
            await batch.commit();
            toast({ title: "Sync Complete", description: `Imported ${newEventsCount} new events from your Google Calendar.` });
        } else {
             toast({ title: "Sync Complete", description: `No new events found to import.` });
        }

    } catch (error: any) {
        toast({ title: "Sync Failed", description: error.message || "Could not sync with Google Calendar.", variant: "destructive" });
    } finally {
        setIsSyncing(false);
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
        <div className="flex items-center gap-4">
             <Button variant="outline" onClick={handleSyncGoogleCalendar} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sync with Google
            </Button>
            <Tabs value={view} onValueChange={setView} className="w-[400px]">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="team">Team View</TabsTrigger>
                    <TabsTrigger value="personal">My Calendar</TabsTrigger>
                </TabsList>
            </Tabs>
        </div>
      </div>
      <div className="flex-grow">
        <FullCalendar
          key={`${view}-${events.length}`} // Re-render the calendar when the view or events change
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
          events={filteredEvents.map(event => ({...event, classNames: event.id.startsWith('gcal-') ? ['gcal-event'] : []}))}
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
