
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast";
import type { Client, Employee, Country, ClientCategory, Department } from "@/lib/data";
import { indianStatesAndUTs } from "@/lib/data";
import * as React from 'react';
import { ScrollArea } from "../ui/scroll-area";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CalendarIcon, Check, ChevronsUpDown, XIcon, Copy, Trash2 } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { cn, capitalizeWords } from "@/lib/utils";
import { Calendar } from "../ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Badge } from "../ui/badge";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";


const residentialStatuses: Client['residentialStatus'][] = ["Resident", "Non-Resident", "Resident but not Ordinarily Resident"];

const clientSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required."),
  mailId: z.string().email("Invalid email address.").or(z.literal('')),
  mobileNumber: z.string().min(1, "Mobile number is required."),
  phoneNumber: z.string().optional(),
  pan: z.string().optional(),
  gstin: z.string().optional(),
  category: z.string().min(1, "Category is required."),
  partnerId: z.string().min(1, "Partner is required."),
  dateOfBirth: z.string().optional(),
  linkedClientIds: z.array(z.string()).optional(),
  contactPerson: z.string().optional(),
  contactPersonDesignation: z.string().optional(),
  residentialStatus: z.enum(residentialStatuses).optional(),
  billingAddressLine1: z.string().optional(),
  billingAddressLine2: z.string().optional(),
  billingAddressLine3: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface EditClientSheetProps {
    client: Client | null | Partial<Client>;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedClient: Partial<Client>) => Promise<void>;
    onDelete: (client: Client) => void;
    allClients?: Client[];
}

export function EditClientSheet({ client, isOpen, onSave, onClose, onDelete, allClients = [] }: EditClientSheetProps) {
    const [partners, setPartners] = React.useState<Employee[]>([]);
    const [countries, setCountries] = React.useState<Country[]>([]);
    const [clientCategories, setClientCategories] = React.useState<ClientCategory[]>([]);
    const [isLinkClientPopoverOpen, setIsLinkClientPopoverOpen] = React.useState(false);
    const { toast } = useToast();
    const [internalAllClients, setInternalAllClients] = React.useState<Client[]>(allClients);

     const {
        register,
        handleSubmit,
        control,
        reset,
        watch,
        setValue,
        formState: { errors },
      } = useForm<ClientFormData>({
        resolver: zodResolver(clientSchema),
        defaultValues: {
            name: '',
            mailId: '',
            mobileNumber: '',
            phoneNumber: '',
            pan: '',
            gstin: '',
            category: '',
            partnerId: '',
            dateOfBirth: undefined,
            linkedClientIds: [],
            contactPerson: '',
            contactPersonDesignation: '',
            residentialStatus: undefined,
            billingAddressLine1: '',
            billingAddressLine2: '',
            billingAddressLine3: '',
            pincode: '',
            country: 'India',
            state: '',
        }
      });


    React.useEffect(() => {
        const fetchMasterData = async () => {
            try {
                const [employeeSnapshot, countriesSnapshot, categoriesSnapshot, deptsSnapshot, clientsSnapshot] = await Promise.all([
                    getDocs(collection(db, "employees")),
                    getDocs(collection(db, "countries")),
                    getDocs(collection(db, "clientCategories")),
                    getDocs(collection(db, "departments")),
                    allClients.length === 0 ? getDocs(collection(db, "clients")) : Promise.resolve(null),
                ]);
                
                const allEmployees = employeeSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Employee));
                const departments = deptsSnapshot.docs.map(doc => doc.data() as Department);
                const partnerDept = departments.find(d => d.name.toLowerCase() === 'partner');
                
                if (partnerDept) {
                    const partnerEmployees = allEmployees.filter(s => Array.isArray(s.role) && s.role.includes(partnerDept.name));
                    setPartners(partnerEmployees);
                }

                const countriesData = countriesSnapshot.docs.map(doc => doc.data() as Country);
                setCountries(countriesData.sort((a, b) => a.name.localeCompare(b.name)));

                const categoriesData = categoriesSnapshot.docs.map(doc => doc.data() as ClientCategory);
                setClientCategories(categoriesData);

                if (clientsSnapshot) {
                    const clientsData = clientsSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Client));
                    setInternalAllClients(clientsData);
                }

            } catch (error) {
                console.error("Error fetching master data:", error);
                toast({ title: "Error", description: "Could not load required data.", variant: "destructive" });
            }
        };
        fetchMasterData();
    }, [toast, allClients]);

    React.useEffect(() => {
        if (isOpen) {
             const defaultValues = {
                ...client,
                name: client?.name || '',
                mailId: client?.mailId || '',
                mobileNumber: client?.mobileNumber || '',
                category: client?.category || '',
                partnerId: client?.partnerId || (partners.length > 0 ? partners[0].id : ''),
                country: client?.country || 'India',
                linkedClientIds: client?.linkedClientIds || [],
            };
            reset(defaultValues as ClientFormData);
        }
    }, [client, isOpen, partners, reset]);

    const handleFormSubmit = async (data: ClientFormData) => {
        const dataToSave = {
            ...data,
            name: capitalizeWords(data.name)
        };
        await onSave(dataToSave);
        onClose();
    };
    
    const showContactPersonFields = watch("category") && watch("category") !== 'Individual';
    const showResidentialStatus = watch("category") === 'Individual';
    const selectedCountry = watch("country");

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-lg">
                <SheetHeader>
                    <div className="flex items-center justify-between">
                        <SheetTitle>{client && 'id' in client ? 'Edit Client' : 'Add New Client'}</SheetTitle>
                        {client && 'id' in client && (
                             <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    navigator.clipboard.writeText(client.id!);
                                    toast({ title: "Copied!", description: "Client ID copied to clipboard." });
                                }}
                            >
                                <Copy className="mr-2" />
                                Copy ID
                            </Button>
                        )}
                    </div>
                    <SheetDescription>
                        {client && 'id' in client ? "Update client information and assignment." : "Enter the details for the new client."} Click save when you're done.
                    </SheetDescription>
                </SheetHeader>
                <form onSubmit={handleSubmit(handleFormSubmit)}>
                <ScrollArea className="h-[calc(100vh-12rem)] pr-6">
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name*</Label>
                        <div className="col-span-3">
                            <Input id="name" {...register("name")} />
                            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                        </div>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="mailId" className="text-right">Email*</Label>
                        <div className="col-span-3">
                            <Input id="mailId" type="email" {...register("mailId")} />
                             {errors.mailId && <p className="text-sm text-destructive mt-1">{errors.mailId.message}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="mobileNumber" className="text-right">Mobile*</Label>
                        <div className="col-span-3">
                            <Input id="mobileNumber" {...register("mobileNumber")} />
                            {errors.mobileNumber && <p className="text-sm text-destructive mt-1">{errors.mobileNumber.message}</p>}
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="phoneNumber" className="text-right">Phone</Label>
                        <Input id="phoneNumber" {...register("phoneNumber")} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="dateOfBirth" className="text-right">DOB</Label>
                        <div className="col-span-3">
                            <Controller
                                name="dateOfBirth"
                                control={control}
                                render={({ field }) => (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                                        </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={field.value ? new Date(field.value) : undefined}
                                                onSelect={(date) => field.onChange(date?.toISOString())}
                                                initialFocus
                                                captionLayout="dropdown-buttons"
                                                fromYear={1900}
                                                toYear={new Date().getFullYear()}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                )}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="pan" className="text-right">PAN</Label>
                        <Input id="pan" {...register("pan")} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">Category*</Label>
                        <div className="col-span-3">
                            <Controller name="category" control={control} render={({field}) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                    <SelectContent>
                                        {clientCategories.map((c) => (<SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            )} />
                            {errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}
                        </div>
                    </div>
                    {showResidentialStatus && (
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="residentialStatus" className="text-right">Residential Status</Label>
                            <Controller name="residentialStatus" control={control} render={({field}) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="col-span-3"><SelectValue placeholder="Select status" /></SelectTrigger>
                                    <SelectContent>
                                        {residentialStatuses.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            )} />
                        </div>
                    )}
                    {showContactPersonFields && (
                        <>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="contactPerson" className="text-right">Contact Person</Label>
                                <Input id="contactPerson" {...register("contactPerson")} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="contactPersonDesignation" className="text-right">Designation</Label>
                                <Input id="contactPersonDesignation" {...register("contactPersonDesignation")} className="col-span-3" />
                            </div>
                        </>
                    )}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="partnerId" className="text-right">Partner*</Label>
                        <div className="col-span-3">
                        <Controller name="partnerId" control={control} render={({field}) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                                <SelectContent>
                                    {partners.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        )} />
                        {errors.partnerId && <p className="text-sm text-destructive mt-1">{errors.partnerId.message}</p>}
                        </div>
                    </div>
                     <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right pt-2">Linked Clients</Label>
                        <div className="col-span-3">
                           <Controller
                                name="linkedClientIds"
                                control={control}
                                render={({ field }) => (
                                    <>
                                     <Popover open={isLinkClientPopoverOpen} onOpenChange={setIsLinkClientPopoverOpen}>
                                        <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between"
                                        >
                                            Select clients to link...
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder="Search clients..." />
                                            <CommandList>
                                                <CommandEmpty>No clients found.</CommandEmpty>
                                                <CommandGroup>
                                                {internalAllClients
                                                    .filter(c => client && 'id' in client ? c.id !== client.id : true)
                                                    .map((c) => (
                                                        <CommandItem
                                                            key={c.id}
                                                            value={c.name}
                                                            onSelect={() => {
                                                                const currentLinks = field.value || [];
                                                                const newLinks = currentLinks.includes(c.id)
                                                                    ? currentLinks.filter(id => id !== c.id)
                                                                    : [...currentLinks, c.id];
                                                                field.onChange(newLinks);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", (field.value || []).includes(c.id) ? "opacity-100" : "opacity-0")} />
                                                            {c.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                        </PopoverContent>
                                    </Popover>
                                     <div className="pt-2 flex flex-wrap gap-2">
                                        {(field.value || []).map(id => {
                                            const linkedClient = internalAllClients.find(c => c.id === id);
                                            if (!linkedClient) return null;
                                            return (
                                                <Badge key={id} variant="secondary">
                                                    {linkedClient.name}
                                                    <button onClick={() => field.onChange(field.value?.filter(currentId => currentId !== id))} className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                                        <XIcon className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                                    </button>
                                                </Badge>
                                            );
                                        })}
                                    </div>
                                </>
                                )}
                           />
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="gstin" className="text-right">GSTN</Label>
                        <Input id="gstin" {...register("gstin")} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="billingAddressLine1" className="text-right">Address 1</Label>
                        <Input id="billingAddressLine1" {...register("billingAddressLine1")} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="billingAddressLine2" className="text-right">Address 2</Label>
                        <Input id="billingAddressLine2" {...register("billingAddressLine2")} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="billingAddressLine3" className="text-right">Address 3</Label>
                        <Input id="billingAddressLine3" {...register("billingAddressLine3")} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="pincode" className="text-right">Pincode</Label>
                        <Input id="pincode" {...register("pincode")} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="country" className="text-right">Country</Label>
                        <Controller name="country" control={control} render={({field}) => (
                             <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="col-span-3"><SelectValue placeholder="Select country" /></SelectTrigger>
                                <SelectContent>
                                    {countries.map((c) => (<SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        )} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="state" className="text-right">State</Label>
                        <div className="col-span-3">
                            {selectedCountry === 'India' ? (
                                 <Controller name="state" control={control} render={({field}) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                                        <SelectContent>
                                            {indianStatesAndUTs.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                 )} />
                            ) : (
                                <Input id="state" {...register("state")} />
                            )}
                        </div>
                    </div>
                </div>
                </ScrollArea>
                <SheetFooter className="pt-4 border-t flex justify-between">
                    <div>
                        {client && 'id' in client && (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => onDelete(client as Client)}
                            >
                                <Trash2 className="mr-2" />
                                Delete Client
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <SheetClose asChild>
                            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        </SheetClose>
                        <Button type="submit">Save changes</Button>
                    </div>
                </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    )
}
