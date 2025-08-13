

"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarEvent, Employee } from "@/lib/data";
import { User } from "firebase/auth";
import { format, parse, parseISO, setHours, setMinutes, setSeconds } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Check, ChevronsUpDown, Globe, Loader2, Video } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ScrollArea } from "../ui/scroll-area";
import { GoogleAuthProvider, reauthenticateWithPopup, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Partial<CalendarEvent>) => void;
  onDelete: (eventId: string) => void;
  eventInfo: any;
  employees: Employee[];
  currentUser: User | null;
}

const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const minutes = ['00', '15', '30', '45'];

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

export function EventDialog({ isOpen, onClose, onSave, onDelete, eventInfo, employees, currentUser }: EventDialogProps) {
  const [formData, setFormData] = React.useState<Partial<CalendarEvent>>({});
  const [startTime, setStartTime] = React.useState({ hour: '09', minute: '00', period: 'AM' });
  const [endTime, setEndTime] = React.useState({ hour: '10', minute: '00', period: 'AM' });
  const { toast } = useToast();
  const [isCreatingMeet, setIsCreatingMeet] = React.useState(false);


  React.useEffect(() => {
    if (eventInfo) {
      const isNew = !eventInfo.id;
      const currentUserEmployee = employees.find(e => e.email === currentUser?.email);

      const startDate = eventInfo.start ? parseISO(eventInfo.start) : (eventInfo.startStr ? parseISO(eventInfo.startStr) : new Date());
      const endDate = eventInfo.end ? parseISO(eventInfo.end) : (eventInfo.endStr ? parseISO(eventInfo.endStr) : new Date(new Date().getTime() + 60*60*1000));

      setFormData({
        id: eventInfo.id || undefined,
        title: eventInfo.title || "",
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        allDay: eventInfo.allDay || false,
        description: eventInfo.description || "",
        attendees: eventInfo.attendees || (isNew && currentUserEmployee ? [currentUserEmployee.id] : []),
        location: eventInfo.location || "",
        engagementId: eventInfo.engagementId || undefined,
        createdBy: eventInfo.createdBy || (isNew && currentUserEmployee ? currentUserEmployee.id : undefined),
        timezone: eventInfo.timezone || (isNew ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'),
      });

      setStartTime({
        hour: format(startDate, 'hh'),
        minute: format(startDate, 'mm'),
        period: format(startDate, 'a').toUpperCase(),
      });
      setEndTime({
        hour: format(endDate, 'hh'),
        minute: format(endDate, 'mm'),
        period: format(endDate, 'a').toUpperCase(),
      });

    }
  }, [eventInfo, currentUser, employees]);
  
  const handleTimeChange = (
    type: 'start' | 'end', 
    part: 'hour' | 'minute' | 'period', 
    value: string
  ) => {
    const timeSetter = type === 'start' ? setStartTime : setEndTime;
    const currentFormDataDate = type === 'start' ? formData.start : formData.end;

    timeSetter(prev => {
        const newTime = { ...prev, [part]: value };
        const dateToUpdate = currentFormDataDate ? parseISO(currentFormDataDate) : new Date();

        let hour24 = parseInt(newTime.hour, 10);
        if (newTime.period === 'PM' && hour24 < 12) {
            hour24 += 12;
        } else if (newTime.period === 'AM' && hour24 === 12) {
            hour24 = 0;
        }
        
        const updatedDate = setSeconds(setMinutes(setHours(dateToUpdate, hour24), parseInt(newTime.minute, 10)), 0);
        
        setFormData(prevData => ({ ...prevData, [type]: updatedDate.toISOString() }));

        return newTime;
    });
  }

  const handleSave = () => {
    onSave(formData);
  };
  
  const handleDelete = () => {
    if (formData.id) {
        onDelete(formData.id);
    }
  }

  const handleAttendeeToggle = (employeeId: string) => {
    setFormData(prev => {
        const currentAttendees = prev.attendees || [];
        const newAttendees = currentAttendees.includes(employeeId)
            ? currentAttendees.filter(id => id !== employeeId)
            : [...currentAttendees, employeeId];
        return { ...prev, attendees: newAttendees };
    })
  };
  
  const handleCreateMeet = async () => {
    if (!currentUser || !formData.title || !formData.start || !formData.end) {
        toast({ title: "Missing Information", description: "Please provide a title and start/end times before creating a meeting.", variant: "destructive" });
        return;
    }
    setIsCreatingMeet(true);

    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/calendar.events");
    
    try {
        const result = await reauthenticateWithPopup(currentUser, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;

        if (!accessToken) {
            throw new Error("Could not get access token for Google Calendar.");
        }

        const event = {
            'summary': formData.title,
            'description': formData.description,
            'start': { 'dateTime': formData.start, 'timeZone': formData.timezone },
            'end': { 'dateTime': formData.end, 'timeZone': formData.timezone },
            'attendees': (formData.attendees || []).map(id => ({'email': employees.find(e => e.id === id)?.email})).filter(e => e.email),
            'conferenceData': {
                'createRequest': {
                    'requestId': `dmv-central-${Date.now()}`,
                    'conferenceSolutionKey': { 'type': 'hangoutsMeet' }
                }
            }
        };

        const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error.message || 'Failed to create Google Calendar event.');
        }

        const createdEvent = await response.json();
        const meetLink = createdEvent.hangoutLink;

        if (meetLink) {
            setFormData({...formData, location: meetLink });
            toast({ title: "Success!", description: "Google Meet link created and added to location." });
        } else {
             throw new Error("Event created, but no Meet link was returned.");
        }

    } catch (error: any) {
        console.error("Error creating Google Meet:", error);
        toast({ title: "Error", description: `Could not create Google Meet link: ${error.message}`, variant: "destructive"});
    } finally {
        setIsCreatingMeet(false);
    }
  }

  const currentUserEmployee = employees.find(e => e.email === currentUser?.email);
  const canEdit = !formData.id || formData.createdBy === currentUserEmployee?.id;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{formData.id ? "Edit Event" : "Create Event"}</DialogTitle>
          <DialogDescription>
            {formData.id && formData.start
                ? `Viewing event on ${format(parseISO(formData.start), 'PPP')}`
                : "Add a new event to the shared calendar."
            }
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              disabled={!canEdit}
            />
          </div>
          {!formData.allDay && (
              <div className="grid grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label>Start Time</Label>
                    <div className="flex gap-1">
                        <Select value={startTime.hour} onValueChange={(v) => handleTimeChange('start', 'hour', v)} disabled={!canEdit}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>{hours.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={startTime.minute} onValueChange={(v) => handleTimeChange('start', 'minute', v)} disabled={!canEdit}>
                             <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>{minutes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                         <Select value={startTime.period} onValueChange={(v) => handleTimeChange('start', 'period', v)} disabled={!canEdit}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AM">AM</SelectItem>
                                <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                 </div>
                 <div className="grid gap-2">
                    <Label>End Time</Label>
                    <div className="flex gap-1">
                         <Select value={endTime.hour} onValueChange={(v) => handleTimeChange('end', 'hour', v)} disabled={!canEdit}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>{hours.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={endTime.minute} onValueChange={(v) => handleTimeChange('end', 'minute', v)} disabled={!canEdit}>
                             <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>{minutes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                         <Select value={endTime.period} onValueChange={(v) => handleTimeChange('end', 'period', v)} disabled={!canEdit}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AM">AM</SelectItem>
                                <SelectItem value="PM">PM</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                 </div>
              </div>
          )}
           <div className="flex items-center space-x-2">
              <Checkbox 
                id="allDay" 
                checked={formData.allDay} 
                onCheckedChange={(checked) => setFormData({...formData, allDay: !!checked})}
                disabled={!canEdit}
              />
              <Label htmlFor="allDay">All-day event</Label>
          </div>
           <div className="grid gap-2">
                <Label htmlFor="timezone">Timezone</Label>
                 <Select value={formData.timezone} onValueChange={(v) => setFormData({...formData, timezone: v})} disabled={!canEdit}>
                    <SelectTrigger id="timezone">
                        <SelectValue placeholder="Select a timezone..." />
                    </SelectTrigger>
                    <SelectContent>
                        <ScrollArea className="h-48">
                            {timezones.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                        </ScrollArea>
                    </SelectContent>
                </Select>
           </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={!canEdit}
            />
          </div>
           <div className="grid gap-2">
            <div className="flex justify-between items-center">
                <Label htmlFor="location">Location / Link</Label>
                {canEdit && <Button variant="outline" size="sm" onClick={handleCreateMeet} disabled={isCreatingMeet}>{isCreatingMeet ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Video className="mr-2 h-4 w-4"/>}Create Google Meet</Button>}
            </div>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Google Meet link or room number"
              disabled={!canEdit}
            />
          </div>
          <div className="grid gap-2">
            <Label>Attendees</Label>
            <Popover>
                <PopoverTrigger asChild disabled={!canEdit}>
                    <Button variant="outline" className="w-full justify-start h-auto min-h-10">
                        <div className="flex gap-1 flex-wrap">
                            {(formData.attendees && formData.attendees.length > 0) ?
                                formData.attendees.map(id => {
                                    const employee = employees.find(e => e.id === id);
                                    return <Badge key={id} variant="secondary">{employee?.name || 'Unknown'}</Badge>
                                }) : "Select attendees..."
                            }
                        </div>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Search employees..." />
                        <CommandList>
                            <CommandEmpty>No employees found.</CommandEmpty>
                            <CommandGroup>
                                {employees.map(employee => (
                                    <CommandItem
                                        key={employee.id}
                                        value={employee.name}
                                        onSelect={() => handleAttendeeToggle(employee.id)}
                                    >
                                        <Checkbox checked={(formData.attendees || []).includes(employee.id)} className="mr-2" />
                                        <span>{employee.name}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          {formData.id && canEdit && (
             <Button type="button" variant="destructive" onClick={handleDelete} className="mr-auto">
              Delete
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {canEdit && (
            <Button type="submit" onClick={handleSave}>
                Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
