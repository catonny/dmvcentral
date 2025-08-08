
"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecurringEngagement, Client, EngagementType, Employee } from "@/lib/data";

const recurringEngagementSchema = z.object({
  clientId: z.string().min(1, "Client is required."),
  engagementTypeId: z.string().min(1, "Engagement type is required."),
  fees: z.coerce.number().min(0, "Fees must be a positive number."),
  isActive: z.boolean().default(true),
  assignedTo: z.array(z.string()).min(1, "At least one assignee is required."),
  reportedTo: z.string().min(1, "A reporter is required."),
});

type FormData = z.infer<typeof recurringEngagementSchema>;

interface AddRecurringEngagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<RecurringEngagement, "id">) => Promise<void>;
  clients: Client[];
  engagementTypes: EngagementType[];
  employees: Employee[];
}

export function AddRecurringEngagementDialog({
  isOpen,
  onClose,
  onSave,
  clients,
  engagementTypes,
  employees,
}: AddRecurringEngagementDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(recurringEngagementSchema),
    defaultValues: {
        isActive: true,
        assignedTo: [],
    }
  });

  const selectedClientId = watch("clientId");

  React.useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client?.partnerId) {
        setValue("reportedTo", client.partnerId);
      }
    }
  }, [selectedClientId, clients, setValue]);

  const onSubmit = async (data: FormData) => {
    setIsSaving(true);
    await onSave(data);
    setIsSaving(false);
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Recurring Engagement</DialogTitle>
          <DialogDescription>
            Set up a new recurring service for a client.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Client</Label>
            <Controller
              name="clientId"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select a client..." /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.clientId && <p className="text-sm text-destructive">{errors.clientId.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>Engagement Type</Label>
            <Controller
              name="engagementTypeId"
              control={control}
              render={({ field }) => (
                 <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select a recurring type..." /></SelectTrigger>
                  <SelectContent>
                    {engagementTypes.map(et => <SelectItem key={et.id} value={et.id}>{et.name} ({et.recurrence})</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.engagementTypeId && <p className="text-sm text-destructive">{errors.engagementTypeId.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>Assign To</Label>
            <Controller
              name="assignedTo"
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
                            {employees.map(employee => (
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
             {errors.assignedTo && <p className="text-sm text-destructive">{errors.assignedTo.message}</p>}
          </div>

           <div className="grid gap-2">
            <Label>Reports To</Label>
            <Controller
              name="reportedTo"
              control={control}
              render={({ field }) => (
                 <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger><SelectValue placeholder="Select a manager/partner..." /></SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => e.role.includes("Manager") || e.role.includes("Partner")).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.reportedTo && <p className="text-sm text-destructive">{errors.reportedTo.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>Fees</Label>
            <Input type="number" {...register("fees")} />
            {errors.fees && <p className="text-sm text-destructive">{errors.fees.message}</p>}
          </div>
          
           <div className="flex items-center space-x-2">
            <Controller
                name="isActive"
                control={control}
                render={({ field }) => (
                     <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
                )}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Engagement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
