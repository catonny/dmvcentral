
"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarIcon, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Workshop, WorkshopArea, Employee } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

const workshopSchema = z.object({
  topic: z.string().min(1, "Topic is required."),
  area: z.string().min(1, "Area is required."),
  speaker: z.string().min(1, "Speaker is required."),
  scheduledAt: z.date({ required_error: "Date and time are required." }),
  durationHours: z.coerce.number().min(0.5, "Duration must be at least 0.5 hours."),
  invitedIds: z.array(z.string()).min(1, "At least one employee must be invited."),
});

type FormData = z.infer<typeof workshopSchema>;

const workshopAreas: WorkshopArea[] = ["Companies Act", "Audit", "Income Tax", "GST", "Other"];

interface CreateWorkshopDialogProps {
  isOpen: boolean;
  onClose: () => void;
  allEmployees: Employee[];
  currentUser: Employee | null;
}

export function CreateWorkshopDialog({ isOpen, onClose, allEmployees, currentUser }: CreateWorkshopDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();
  
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(workshopSchema),
    defaultValues: {
        invitedIds: []
    }
  });

  const onSubmit = async (data: FormData) => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
        const workshopRef = doc(collection(db, "workshops"));
        const newWorkshop: Workshop = {
            id: workshopRef.id,
            ...data,
            scheduledAt: data.scheduledAt.toISOString(),
            attendeeIds: [],
            createdBy: currentUser.id,
            createdAt: new Date().toISOString(),
        };
        await setDoc(workshopRef, newWorkshop);
        toast({ title: "Success", description: "Workshop created successfully." });
        reset();
        onClose();
    } catch(e) {
        console.error("Error creating workshop", e);
        toast({ title: "Error", description: "Could not create the workshop.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Workshop</DialogTitle>
          <DialogDescription>Fill in the details to schedule a new learning session.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label>Topic</Label>
            <Input {...register("topic")} />
            {errors.topic && <p className="text-sm text-destructive">{errors.topic.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="grid gap-2">
                <Label>Area</Label>
                <Controller
                    name="area"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Select area..." /></SelectTrigger>
                        <SelectContent>
                            {workshopAreas.map(area => <SelectItem key={area} value={area}>{area}</SelectItem>)}
                        </SelectContent>
                        </Select>
                    )}
                />
                 {errors.area && <p className="text-sm text-destructive">{errors.area.message}</p>}
            </div>
            <div className="grid gap-2">
                <Label>Speaker</Label>
                <Input {...register("speaker")} />
                {errors.speaker && <p className="text-sm text-destructive">{errors.speaker.message}</p>}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
                <Label>Date & Time</Label>
                 <Controller
                    name="scheduledAt"
                    control={control}
                    render={({ field }) => (
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn(!field.value && "text-muted-foreground")}>
                                    {field.value ? format(field.value, "PPP p") : "Select date & time"}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50"/>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/>
                                <div className="p-3 border-t border-border">
                                    <Input type="time" onChange={(e) => {
                                        const [hours, minutes] = e.target.value.split(':');
                                        const newDate = new Date(field.value || new Date());
                                        newDate.setHours(Number(hours), Number(minutes));
                                        field.onChange(newDate);
                                    }}/>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                />
                 {errors.scheduledAt && <p className="text-sm text-destructive">{errors.scheduledAt.message}</p>}
            </div>
             <div className="grid gap-2">
                <Label>Duration (Hours)</Label>
                <Input type="number" {...register("durationHours")} step="0.5"/>
                {errors.durationHours && <p className="text-sm text-destructive">{errors.durationHours.message}</p>}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Invite Employees</Label>
            <Controller
              name="invitedIds"
              control={control}
              render={({ field }) => (
                 <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">{field.value?.length > 0 ? `${field.value.length} selected` : "Select employees..."}</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Search..." />
                        <CommandList>
                           <CommandEmpty>No results found.</CommandEmpty>
                           <CommandGroup>
                            {allEmployees.map(employee => (
                                <CommandItem
                                key={employee.id}
                                onSelect={() => {
                                    const newValue = field.value?.includes(employee.id)
                                    ? field.value.filter(id => id !== employee.id)
                                    : [...(field.value || []), employee.id];
                                    field.onChange(newValue);
                                }}
                                >
                                <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", field.value?.includes(employee.id) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                    <Check className="h-4 w-4" />
                                </div>
                                {employee.name}
                                </CommandItem>
                            ))}
                           </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
              )}
            />
            {errors.invitedIds && <p className="text-sm text-destructive">{errors.invitedIds.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Schedule Workshop
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
