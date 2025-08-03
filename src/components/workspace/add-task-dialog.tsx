
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Client, EngagementType, Employee, Department } from "@/lib/data";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandCreate
} from "@/components/ui/command";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { doc, setDoc, collection, addDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { EditClientSheet } from "../dashboard/edit-client-sheet";
import { Checkbox } from "../ui/checkbox";


const engagementSchema = z.object({
  type: z.string({ required_error: "Please select an engagement type." }).min(1, "Please select an engagement type."),
  clientId: z.string({ required_error: "Please select a client." }),
  dueDate: z.date({ required_error: "Please select a due date." }),
  remarks: z.string().min(1, "Remarks are required."),
  reportedTo: z.string().optional(),
  saveAsTemplate: z.boolean().default(false),
  templateName: z.string().optional(),
}).refine(data => {
    if (data.saveAsTemplate) {
        return !!data.templateName && data.templateName.length > 0;
    }
    return true;
}, {
    message: "Template name is required when saving as a template.",
    path: ["templateName"],
});

type EngagementFormData = z.infer<typeof engagementSchema>;

interface AddTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EngagementFormData, client?: Client, reporterId?: string) => Promise<void>;
  clients: Client[];
  engagementTypes: EngagementType[];
  allEmployees: Employee[];
  departments: Department[];
}

export function AddTaskDialog({ isOpen, onClose, onSave, clients, engagementTypes, allEmployees, departments }: AddTaskDialogProps) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EngagementFormData>({
    resolver: zodResolver(engagementSchema),
    defaultValues: {
        remarks: "",
        clientId: "",
        type: "",
        reportedTo: "",
        saveAsTemplate: false,
    }
  });
  
  const [isClientPopoverOpen, setIsClientPopoverOpen] = React.useState(false);
  const [isEngagementPopoverOpen, setIsEngagementPopoverOpen] = React.useState(false);
  const [clientSearchQuery, setClientSearchQuery] = React.useState("");
  const [isClientSheetOpen, setIsClientSheetOpen] = React.useState(false);
  const [newClientData, setNewClientData] = React.useState<Partial<Client> | null>(null);

  const [engagementSearchQuery, setEngagementSearchQuery] = React.useState("");
  const saveAsTemplate = watch("saveAsTemplate");
  const [dueDateString, setDueDateString] = React.useState("");


  const managersAndPartners = React.useMemo(() => {
    const managerAndPartnerDepts = departments
        .filter(d => d.name.toLowerCase() === 'manager' || d.name.toLowerCase() === 'partner')
        .map(d => d.name);
    
    if (managerAndPartnerDepts.length === 0) return [];
    
    return allEmployees.filter(s => 
        Array.isArray(s.role) && s.role.some(r => managerAndPartnerDepts.includes(r))
    );
  }, [allEmployees, departments]);


  const handleFormSubmit = async (data: EngagementFormData) => {
    const client = clients.find(c => c.id === data.clientId);
    let reporterId = data.reportedTo;
    
    if (!reporterId && client && client.Partner) {
        const partner = allEmployees.find(s => s.name === client.Partner);
        if (partner) {
            reporterId = partner.id;
        }
    }

    await onSave(data, client, reporterId);
    reset();
  };

  const handleClose = () => {
    reset();
    setClientSearchQuery("");
    setDueDateString("");
    onClose();
  };

  const selectedClientId = watch("clientId");
  const selectedClient = clients.find(c => c.id === selectedClientId);
  
  React.useEffect(() => {
    if (selectedClient && selectedClient.Partner) {
        const partner = allEmployees.find(s => s.name === selectedClient.Partner);
        if (partner) {
            setValue("reportedTo", partner.id, { shouldValidate: true });
        } else {
            setValue("reportedTo", "", { shouldValidate: true });
        }
    } else {
        setValue("reportedTo", "", { shouldValidate: true });
    }
  }, [selectedClient, allEmployees, setValue]);


  const filteredClients = React.useMemo(() => {
    if (!clientSearchQuery) return clients;
    return clients.filter(c => c.Name.toLowerCase().includes(clientSearchQuery.toLowerCase()));
  }, [clients, clientSearchQuery]);
  
  const showCreateClientOption = clientSearchQuery && !filteredClients.some(c => c.Name.toLowerCase() === clientSearchQuery.toLowerCase());


  const filteredEngagementTypes = React.useMemo(() => {
      let types = engagementTypes;
      if (selectedClient?.Category) {
          types = engagementTypes.filter(et => 
              !et.applicableCategories || et.applicableCategories.length === 0 || et.applicableCategories.includes(selectedClient.Category!)
          );
      }
      if (engagementSearchQuery) {
          return types.filter(et => et.name.toLowerCase().includes(engagementSearchQuery.toLowerCase()));
      }
      return types;
  }, [engagementTypes, selectedClient, engagementSearchQuery]);
  
  const handleClientSelect = (clientId: string) => {
    setValue("clientId", clientId, { shouldValidate: true });
    setValue("type", "", { shouldValidate: true }); 
    setIsClientPopoverOpen(false);
  };
  
  const handleCreateNewClient = () => {
    setNewClientData({ Name: clientSearchQuery });
    setIsClientPopoverOpen(false);
    setIsClientSheetOpen(true);
  };
  
  const handleSaveNewClient = async (clientData: Partial<Client>) => {
    try {
        const batch = writeBatch(db);
        const clientRef = doc(collection(db, "clients"));
        const newClient = { ...clientData, id: clientRef.id, lastUpdated: new Date().toISOString() };
        batch.set(clientRef, newClient);
        await batch.commit();

        toast({ title: "Success", description: "New client added successfully." });
        
        // This relies on the parent component (AssignmentList) to update `allClients` via its snapshot listener.
        // We optimistically update our local value here for immediate use.
        setValue("clientId", clientRef.id, { shouldValidate: true });
        
        setIsClientSheetOpen(false);
        setNewClientData(null);
        setClientSearchQuery("");
    } catch (error) {
        console.error("Error saving client:", error);
        toast({ title: "Error", description: "Failed to save client data.", variant: "destructive" });
    }
  };


  const handleEngagementTypeSelect = (value: string) => {
    const type = engagementTypes.find(et => et.id.toLowerCase() === value.toLowerCase() || et.name.toLowerCase() === value.toLowerCase());
    
    if (type) {
         setValue("type", type.id, { shouldValidate: true });
    } else {
         setValue("type", value, { shouldValidate: true });
         setValue("saveAsTemplate", true);
         setValue("templateName", value);
    }
     
     setIsEngagementPopoverOpen(false);
     setEngagementSearchQuery("");
  }


  const showCreateOption = engagementSearchQuery && !filteredEngagementTypes.some(et => et.name.toLowerCase() === engagementSearchQuery.toLowerCase());
  
  const selectedTypeId = watch("type");
  const isExistingType = engagementTypes.some(et => et.id === selectedTypeId);
  const currentDueDate = watch("dueDate");

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Engagement</DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new engagement. Sub-tasks will be created automatically based on the engagement type.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-4 py-4">
           <div className="grid gap-2">
            <Label>Client</Label>
            <Controller
              name="clientId"
              control={control}
              render={({ field }) => (
                 <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isClientPopoverOpen}
                        className="w-full justify-between"
                      >
                        {field.value
                          ? clients.find((client) => client.id === field.value)?.Name
                          : "Select or create client..."}
                           <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput 
                          placeholder="Search client..." 
                          value={clientSearchQuery}
                          onValueChange={setClientSearchQuery}
                        />
                        <CommandList>
                            <CommandEmpty>
                                <div className="p-4 text-sm text-center">
                                    No client found. <br/>
                                    <Button variant="link" onClick={handleCreateNewClient} className="h-auto p-1 mt-1">
                                        <PlusCircle className="mr-2" />
                                        Add New Client
                                    </Button>
                                </div>
                            </CommandEmpty>
                            <CommandGroup>
                            {filteredClients.map((client) => (
                                <CommandItem
                                key={client.id}
                                value={client.Name}
                                onSelect={() => {
                                  handleClientSelect(client.id);
                                }}
                                >
                                <Check
                                    className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === client.id ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {client.Name}
                                </CommandItem>
                            ))}
                            {showCreateClientOption && (
                                <CommandCreate onSelect={handleCreateNewClient}>
                                    Create "{clientSearchQuery}"
                                </CommandCreate>
                            )}
                            </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
              )}
            />
            {errors.clientId && <p className="text-sm text-red-500">{errors.clientId.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>Engagement Type</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Popover open={isEngagementPopoverOpen} onOpenChange={setIsEngagementPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={isEngagementPopoverOpen}
                      className="w-full justify-between"
                      disabled={!selectedClientId}
                    >
                      {field.value
                        ? engagementTypes.find((et) => et.id === field.value)?.name || field.value
                        : "Select or create type..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput 
                        placeholder="Search type..."
                        value={engagementSearchQuery}
                        onValueChange={setEngagementSearchQuery}
                      />
                      <CommandList>
                        {filteredEngagementTypes.length === 0 && !showCreateOption && <CommandEmpty>No types found for this client.</CommandEmpty>}
                        <CommandGroup>
                          {filteredEngagementTypes.map((et) => (
                            <CommandItem
                              key={et.id}
                              value={et.name}
                              onSelect={() => handleEngagementTypeSelect(et.id)}
                            >
                               <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  field.value === et.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {et.name}
                            </CommandItem>
                          ))}
                           {showCreateOption && (
                                <CommandCreate onSelect={() => handleEngagementTypeSelect(engagementSearchQuery)}>
                                    Create "{engagementSearchQuery}"
                                </CommandCreate>
                            )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            />
            {errors.type && <p className="text-sm text-red-500">{errors.type.message}</p>}
          </div>
          
           <div className="grid gap-2">
            <Label>Due Date</Label>
            <Controller
                name="dueDate"
                control={control}
                render={({ field }) => (
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder="dd/MM/yyyy"
                            value={dueDateString}
                            onChange={(e) => {
                                let value = e.target.value.replace(/[^0-9]/g, '');
                                if (value.length > 2) value = `${value.substring(0, 2)}/${value.substring(2)}`;
                                if (value.length > 5) value = `${value.substring(0, 5)}/${value.substring(5, 9)}`;
                                setDueDateString(value);

                                if (value.length === 10) {
                                    const parsedDate = parse(value, 'dd/MM/yyyy', new Date());
                                    if (isValid(parsedDate)) {
                                        field.onChange(parsedDate);
                                    }
                                }
                            }}
                        />
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className="p-2 h-auto"
                            >
                                <CalendarIcon className="h-4 w-4" />
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={(date) => {
                                        field.onChange(date);
                                        if (date) setDueDateString(format(date, 'dd/MM/yyyy'));
                                    }}
                                    initialFocus
                                    captionLayout="dropdown-buttons"
                                    fromYear={new Date().getFullYear() - 10}
                                    toYear={new Date().getFullYear() + 10}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                )}
            />
            {errors.dueDate && <p className="text-sm text-red-500">{errors.dueDate.message}</p>}
          </div>

          <div className="grid gap-2">
            <Label>Report to</Label>
             <Controller
              name="reportedTo"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a manager or partner" />
                    </SelectTrigger>
                    <SelectContent>
                         {managersAndPartners.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name} ({Array.isArray(s.role) ? s.role.join(', ') : s.role})</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              )}
            />
            {errors.reportedTo && <p className="text-sm text-red-500">{errors.reportedTo.message}</p>}
          </div>
          
           <div className="grid gap-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" {...register("remarks")} />
            {errors.remarks && <p className="text-sm text-red-500">{errors.remarks.message}</p>}
          </div>
          
           <div className="items-center flex space-x-2">
                <Controller
                    name="saveAsTemplate"
                    control={control}
                    render={({ field }) => (
                        <Checkbox
                            id="saveAsTemplate"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isExistingType}
                        />
                    )}
                />
                <Label htmlFor="saveAsTemplate" className="text-sm font-medium leading-none">
                    Save as a reusable template
                </Label>
           </div>
           {saveAsTemplate && (
                <div className="grid gap-2">
                    <Label htmlFor="templateName">Template Name</Label>
                    <Input id="templateName" {...register("templateName")} disabled={isExistingType} />
                    {errors.templateName && <p className="text-sm text-red-500">{errors.templateName.message}</p>}
                </div>
            )}
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">Add Engagement</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
     <EditClientSheet
        client={newClientData}
        isOpen={isClientSheetOpen}
        onClose={() => setIsClientSheetOpen(false)}
        onSave={handleSaveNewClient}
        allClients={clients}
      />
    </>
  );
}

    