
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
import { format, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Partial<CalendarEvent>) => void;
  onDelete: (eventId: string) => void;
  eventInfo: any;
  employees: Employee[];
  currentUser: User | null;
}

export function EventDialog({ isOpen, onClose, onSave, onDelete, eventInfo, employees, currentUser }: EventDialogProps) {
  const [formData, setFormData] = React.useState<Partial<CalendarEvent>>({});

  React.useEffect(() => {
    if (eventInfo) {
      const isNew = !eventInfo.id;
      setFormData({
        id: eventInfo.id || undefined,
        title: eventInfo.title || "",
        start: eventInfo.startStr || eventInfo.start,
        end: eventInfo.endStr || eventInfo.end,
        allDay: eventInfo.allDay || false,
        description: eventInfo.description || "",
        attendees: eventInfo.attendees || (isNew && currentUser ? [currentUser.uid] : []),
      });
    }
  }, [eventInfo, currentUser]);

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

  const canEdit = !formData.id || formData.createdBy === currentUser?.uid;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{formData.id ? "Edit Event" : "Create Event"}</DialogTitle>
          <DialogDescription>
            {formData.id 
                ? `Viewing event on ${format(parseISO(formData.start!), 'PPP')}`
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
           <div className="flex items-center space-x-2">
              <Checkbox 
                id="allDay" 
                checked={formData.allDay} 
                onCheckedChange={(checked) => setFormData({...formData, allDay: !!checked})}
                disabled={!canEdit}
              />
              <Label htmlFor="allDay">All-day event</Label>
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
