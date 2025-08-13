
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
import { CalendarEvent, Employee, Engagement } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Badge } from "../ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";

interface ScheduleMeetingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  engagement: Engagement | null;
  employees: Employee[];
  currentUser: Employee | null;
}

export function ScheduleMeetingDialog({ isOpen, onClose, engagement, employees, currentUser }: ScheduleMeetingDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = React.useState<Partial<CalendarEvent>>({});
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (engagement && currentUser) {
      // Default attendees to the current user and those assigned to the engagement
      const initialAttendees = Array.from(new Set([currentUser.id, ...engagement.assignedTo]));
      
      setFormData({
        title: `Meeting for ${engagement.remarks}`,
        description: `Discussion about the engagement: ${engagement.remarks}`,
        start: new Date().toISOString(),
        end: new Date(new Date().getTime() + 60 * 60 * 1000).toISOString(),
        allDay: false,
        attendees: initialAttendees,
        engagementId: engagement.id,
        createdBy: currentUser.id,
      });
    }
  }, [engagement, currentUser, isOpen]);
  
  const handleAttendeeToggle = (employeeId: string) => {
    setFormData(prev => {
        const currentAttendees = prev.attendees || [];
        const newAttendees = currentAttendees.includes(employeeId)
            ? currentAttendees.filter(id => id !== employeeId)
            : [...currentAttendees, employeeId];
        return { ...prev, attendees: newAttendees };
    })
  };

  const handleSave = async () => {
    if (!engagement || !formData.title) {
        toast({ title: "Validation Error", description: "Title is required.", variant: "destructive"});
        return;
    }
    setIsLoading(true);
    try {
        const eventRef = doc(collection(db, "events"));
        const newEvent = {
            ...formData,
            id: eventRef.id
        }
        await setDoc(eventRef, newEvent);
        toast({ title: "Meeting Scheduled", description: "The new event has been added to the calendar."});
        onClose();
    } catch (error) {
        console.error("Error scheduling meeting:", error);
        toast({ title: "Error", description: "Could not schedule the meeting.", variant: "destructive"});
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule a Meeting</DialogTitle>
          <DialogDescription>
            Create a new calendar event for the engagement: <span className="font-semibold">{engagement?.remarks}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
           <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
            </div>
             <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
            </div>
             <div className="space-y-2">
                <Label>Attendees</Label>
                 <Popover>
                    <PopoverTrigger asChild>
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            Schedule Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

