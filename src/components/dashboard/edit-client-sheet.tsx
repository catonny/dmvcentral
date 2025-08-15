
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

interface EditClientSheetProps {
    client: Client | null | Partial<Client>;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedClient: Partial<Client>) => Promise<void>;
    onDelete: (client: Client) => void;
    allClients?: Client[];
}

const residentialStatuses: Client['residentialStatus'][] = ["Resident", "Non-Resident", "Resident but not Ordinarily Resident"];


export function EditClientSheet({ client, isOpen, onSave, onClose, onDelete, allClients = [] }: EditClientSheetProps) {
    const [formData, setFormData] = React.useState<Partial<Client>>({});
    const [partners, setPartners] = React.useState<Employee[]>([]);
    const [countries, setCountries] = React.useState<Country[]>([]);
    const [clientCategories, setClientCategories] = React.useState<ClientCategory[]>([]);
    const [isLinkClientPopoverOpen, setIsLinkClientPopoverOpen] = React.useState(false);
    const { toast } = useToast();
    const [internalAllClients, setInternalAllClients] = React.useState<Client[]>(allClients);
    const [dobString, setDobString] = React.useState("");

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
            const initialData = client || {
                name: '',
                mailId: '',
                mobileNumber: '',
                phoneNumber: '',
                pan: '',
                gstin: '',
                billingAddressLine1: '',
                billingAddressLine2: '',
                billingAddressLine3: '',
                pincode: '',
                state: '',
                country: 'India',
                partnerId: partners.length > 0 ? partners[0].id : undefined,
                category: undefined,
                dateOfBirth: undefined,
                linkedClientIds: [],
                contactPerson: '',
                contactPersonDesignation: '',
                residentialStatus: undefined,
            };
            setFormData(initialData);
            if (initialData.dateOfBirth) {
                try {
                    setDobString(format(new Date(initialData.dateOfBirth), 'dd/MM/yyyy'));
                } catch {
                    setDobString("");
                }
            } else {
                setDobString("");
            }
        }
    }, [client, isOpen, partners]);

    const handleSave = async () => {
        if (!formData.name || !formData.mobileNumber || !formData.mailId || !formData.category || !formData.partnerId) {
            toast({ title: "Validation Error", description: "Name, Mobile, Email, Category, and Partner are required.", variant: "destructive" });
            return;
        }

        const dataToSave = { ...formData };
        if (dataToSave.name) {
            dataToSave.name = capitalizeWords(dataToSave.name);
        }
        if (dataToSave.dateOfBirth === undefined) {
            delete dataToSave.dateOfBirth;
        }

        await onSave(dataToSave);
        onClose();
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    }
    
    const handleSelectChange = (field: keyof Client) => (value: string) => {
        setFormData({ ...formData, [field]: value });
    }

    const handleDateChange = (date: Date | undefined) => {
        if (date) {
            setFormData({ ...formData, dateOfBirth: date.toISOString() });
            setDobString(format(date, 'dd/MM/yyyy'));
        }
    }
    
    const handleDobStringChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 2) {
            value = `${value.substring(0, 2)}/${value.substring(2)}`;
        }
        if (value.length > 5) {
            value = `${value.substring(0, 5)}/${value.substring(5, 9)}`;
        }
        setDobString(value);

        if (value.length === 10) {
            const parsedDate = parse(value, 'dd/MM/yyyy', new Date());
            if (isValid(parsedDate)) {
                 setFormData({ ...formData, dateOfBirth: parsedDate.toISOString() });
            }
        }
    };

    const handleLinkClientToggle = (clientId: string) => {
        const currentLinks = formData.linkedClientIds || [];
        const newLinks = currentLinks.includes(clientId)
            ? currentLinks.filter(id => id !== clientId)
            : [...currentLinks, clientId];
        setFormData({ ...formData, linkedClientIds: newLinks });
    }
    
    const showContactPersonFields = formData.category && formData.category !== 'Individual';
    const showResidentialStatus = formData.category === 'Individual';

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
                <ScrollArea className="h-[calc(100vh-12rem)] pr-6">
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name*</Label>
                        <Input id="name" value={formData.name || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="mailId" className="text-right">Email*</Label>
                        <Input id="mailId" type="email" value={formData.mailId || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="mobileNumber" className="text-right">Mobile*</Label>
                        <Input id="mobileNumber" value={formData.mobileNumber || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="phoneNumber" className="text-right">Phone</Label>
                        <Input id="phoneNumber" value={formData.phoneNumber || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="dateOfBirth" className="text-right">DOB</Label>
                        <div className="col-span-3 flex items-center gap-2">
                             <Input 
                                id="dateOfBirth" 
                                placeholder="dd/MM/yyyy"
                                value={dobString}
                                onChange={handleDobStringChange}
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
                                        selected={formData.dateOfBirth ? new Date(formData.dateOfBirth) : undefined}
                                        onSelect={handleDateChange}
                                        initialFocus
                                        captionLayout="dropdown-buttons"
                                        fromYear={1900}
                                        toYear={new Date().getFullYear()}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="pan" className="text-right">PAN</Label>
                        <Input id="pan" value={formData.pan || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">Category*</Label>
                        <Select onValueChange={handleSelectChange('category')} value={formData.category}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                                {clientCategories.map((c) => (
                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {showResidentialStatus && (
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="residentialStatus" className="text-right">Residential Status</Label>
                            <Select onValueChange={handleSelectChange('residentialStatus')} value={formData.residentialStatus}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {residentialStatuses.map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {showContactPersonFields && (
                        <>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="contactPerson" className="text-right">Contact Person</Label>
                                <Input id="contactPerson" value={formData.contactPerson || ''} onChange={handleChange} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="contactPersonDesignation" className="text-right">Designation</Label>
                                <Input id="contactPersonDesignation" value={formData.contactPersonDesignation || ''} onChange={handleChange} className="col-span-3" />
                            </div>
                        </>
                    )}

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="partnerId" className="text-right">Partner*</Label>
                        <Select onValueChange={handleSelectChange('partnerId')} value={formData.partnerId}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select partner" />
                            </SelectTrigger>
                            <SelectContent>
                                {partners.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right pt-2">Linked Clients</Label>
                        <div className="col-span-3">
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
                                <Command shouldFilter={false}>
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
                                                    onSelect={() => handleLinkClientToggle(c.id)}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", (formData.linkedClientIds || []).includes(c.id) ? "opacity-100" : "opacity-0")} />
                                                    {c.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                                </PopoverContent>
                            </Popover>
                             <div className="pt-2 flex flex-wrap gap-2">
                                {(formData.linkedClientIds || []).map(id => {
                                    const linkedClient = internalAllClients.find(c => c.id === id);
                                    if (!linkedClient) return null;
                                    return (
                                        <Badge key={id} variant="secondary">
                                            {linkedClient.name}
                                            <button onClick={() => handleLinkClientToggle(id)} className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                                <XIcon className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                            </button>
                                        </Badge>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="gstin" className="text-right">GSTN</Label>
                        <Input id="gstin" value={formData.gstin || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="billingAddressLine1" className="text-right">Address 1</Label>
                        <Input id="billingAddressLine1" value={formData.billingAddressLine1 || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="billingAddressLine2" className="text-right">Address 2</Label>
                        <Input id="billingAddressLine2" value={formData.billingAddressLine2 || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="billingAddressLine3" className="text-right">Address 3</Label>
                        <Input id="billingAddressLine3" value={formData.billingAddressLine3 || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="pincode" className="text-right">Pincode</Label>
                        <Input id="pincode" value={formData.pincode || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="country" className="text-right">Country</Label>
                        <Select onValueChange={handleSelectChange('country')} value={formData.country}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                                {countries.map((c) => (
                                    <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="state" className="text-right">State</Label>
                        {formData.country === 'India' ? (
                            <Select onValueChange={handleSelectChange('state')} value={formData.state}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select state" />
                                </SelectTrigger>
                                <SelectContent>
                                    {indianStatesAndUTs.map((s) => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input id="state" value={formData.state || ''} onChange={handleChange} className="col-span-3" />
                        )}
                    </div>
                </div>
                </ScrollArea>
                <SheetFooter className="pt-4 border-t flex justify-between">
                    <div>
                        {client && 'id' in client && (
                            <Button
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
                        <Button type="submit" onClick={handleSave}>Save changes</Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
