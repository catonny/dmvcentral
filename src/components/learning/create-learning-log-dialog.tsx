
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
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LearningLog, WorkshopArea, Employee } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Textarea } from "../ui/textarea";

const learningLogSchema = z.object({
  date: z.date({ required_error: "Date is required." }),
  durationHours: z.coerce.number().min(0.5, "Duration must be at least 0.5 hours."),
  area: z.string().min(1, "Area is required."),
  topic: z.string().min(1, "Topic is required."),
  description: z.string().min(1, "Description is required"),
});

type FormData = z.infer<typeof learningLogSchema>;

const workshopAreas: WorkshopArea[] = ["Companies Act", "Audit", "Income Tax", "GST", "Other"];

interface CreateLearningLogDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Employee | null;
}

export function CreateLearningLogDialog({ isOpen, onClose, currentUser }: CreateLearningLogDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();
  
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(learningLogSchema),
  });

  const onSubmit = async (data: FormData) => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
        const logRef = doc(collection(db, "learningLogs"));
        const newLog: LearningLog = {
            id: logRef.id,
            ...data,
            date: data.date.toISOString(),
            userId: currentUser.id,
        };
        await setDoc(logRef, newLog);
        toast({ title: "Success", description: "Learning hours logged successfully." });
        reset();
        onClose();
    } catch(e) {
        console.error("Error logging learning hours:", e);
        toast({ title: "Error", description: "Could not log learning hours.", variant: "destructive" });
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
          <DialogTitle>Log Learning Hours</DialogTitle>
          <DialogDescription>Record your self-study or other non-workshop learning activities.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>Date</Label>
                    <Controller
                        name="date"
                        control={control}
                        render={({ field }) => (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn(!field.value && "text-muted-foreground")}>
                                        {field.value ? format(field.value, "PPP") : "Select date"}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50"/>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus/></PopoverContent>
                            </Popover>
                        )}
                    />
                    {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
                </div>
                 <div className="grid gap-2">
                    <Label>Duration (Hours)</Label>
                    <Input type="number" {...register("durationHours")} step="0.5"/>
                    {errors.durationHours && <p className="text-sm text-destructive">{errors.durationHours.message}</p>}
                </div>
            </div>

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
                <Label>Topic</Label>
                <Input {...register("topic")} />
                {errors.topic && <p className="text-sm text-destructive">{errors.topic.message}</p>}
            </div>
            
            <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea {...register("description")} placeholder="Describe what you learned or studied." />
                {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>
            
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Hours
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
