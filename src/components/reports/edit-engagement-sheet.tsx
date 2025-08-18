

"use client";

import * as React from 'react';
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
import type { Employee, Engagement } from "@/lib/data";
import { ScrollArea } from "../ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "../ui/calendar";
import { ReportsEngagement } from '@/app/(app)/reports/engagements/page';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";


interface EditEngagementSheetProps {
    engagement: ReportsEngagement | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedEngagement: Partial<Engagement>) => Promise<void>;
    allEmployees: Employee[];
}

const generateFinancialYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = -5; i <= 1; i++) {
        const startYear = currentYear + i;
        const endYear = (startYear + 1).toString().slice(-2);
        years.push(`${startYear}-${endYear}`);
    }
    return years.reverse();
}

export function EditEngagementSheet({ engagement, isOpen, onSave, onClose, allEmployees }: EditEngagementSheetProps) {
    const [formData, setFormData] = React.useState<Partial<Engagement>>({});
    const [dueDateString, setDueDateString] = React.useState("");
    const { toast } = useToast();
    const financialYears = generateFinancialYears();

    React.useEffect(() => {
        if (isOpen && engagement) {
            setFormData(engagement);
            if (engagement.dueDate) {
                try {
                    setDueDateString(format(new Date(engagement.dueDate), 'dd/MM/yyyy'));
                } catch {
                    setDueDateString("");
                }
            }
        }
    }, [engagement, isOpen]);

    const handleSave = async () => {
        if (!formData.remarks) {
            toast({ title: "Validation Error", description: "Remarks cannot be empty.", variant: "destructive" });
            return;
        }
        await onSave(formData);
        onClose();
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    }
    
    const handleSelectChange = (field: keyof Engagement) => (value: string | string[]) => {
        setFormData({ ...formData, [field]: value });
    }

    const handleDateChange = (date: Date | undefined) => {
        if (date) {
            setFormData({ ...formData, 'dueDate': date.toISOString() });
            setDueDateString(format(date, 'dd/MM/yyyy'));
        }
    }

    const handleDueDateStringChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/[^0-9]/g, '');
        if (value.length > 2) value = `${value.substring(0, 2)}/${value.substring(2)}`;
        if (value.length > 5) value = `${value.substring(0, 5)}/${value.substring(5, 9)}`;
        setDueDateString(value);

        if (value.length === 10) {
            const parsedDate = parse(value, 'dd/MM/yyyy', new Date());
            if (isValid(parsedDate)) {
                 setFormData({ ...formData, 'dueDate': parsedDate.toISOString() });
            }
        }
    };
    
    const handleAssigneeToggle = (employeeId: string) => {
        const currentAssignees = formData.assignedTo || [];
        const newAssignees = currentAssignees.includes(employeeId)
            ? currentAssignees.filter(id => id !== employeeId)
            : [...currentAssignees, employeeId];
        setFormData({ ...formData, assignedTo: newAssignees });
    };


    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>Edit Engagement</SheetTitle>
                    <SheetDescription>
                        Update engagement details. Click save when you're done.
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-12rem)] pr-6">
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="clientName" className="text-right">Client</Label>
                        <Input id="clientName" value={engagement?.clientName || ''} disabled className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="engagementTypeName" className="text-right">Type</Label>
                        <Input id="engagementTypeName" value={engagement?.engagementTypeName || ''} disabled className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="financialYear" className="text-right">Financial Year</Label>
                        <Select onValueChange={handleSelectChange('financialYear')} value={formData.financialYear}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select year" />
                            </SelectTrigger>
                            <SelectContent>
                                {financialYears.map((year) => (
                                    <SelectItem key={year} value={year}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="remarks" className="text-right">Remarks</Label>
                        <Textarea id="remarks" value={formData.remarks || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right pt-2">Assigned To</Label>
                        <div className="col-span-3 space-y-2">
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start">
                                        <div className="flex gap-1 flex-wrap">
                                            {(formData.assignedTo && formData.assignedTo.length > 0) ? 
                                                formData.assignedTo.map(id => (
                                                    <Badge key={id} variant="secondary">
                                                        {allEmployees.find(e => e.id === id)?.name || '...'}
                                                    </Badge>
                                                )) : "Select team members..."}
                                        </div>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search employees..." />
                                        <CommandList>
                                            <CommandEmpty>No employees found.</CommandEmpty>
                                            <CommandGroup>
                                            {allEmployees.map(employee => (
                                                <CommandItem
                                                    key={employee.id}
                                                    value={employee.name}
                                                    onSelect={() => handleAssigneeToggle(employee.id)}
                                                >
                                                    <Checkbox checked={(formData.assignedTo || []).includes(employee.id)} className="mr-2"/>
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
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="dueDate" className="text-right">Due Date</Label>
                        <div className="col-span-3 flex items-center gap-2">
                            <Input 
                                id="dueDate"
                                placeholder="dd/MM/yyyy"
                                value={dueDateString}
                                onChange={handleDueDateStringChange}
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
                                        selected={formData.dueDate ? new Date(formData.dueDate) : undefined}
                                        onSelect={handleDateChange}
                                        initialFocus
                                        captionLayout="dropdown-buttons"
                                        fromYear={new Date().getFullYear() - 10}
                                        toYear={new Date().getFullYear() + 10}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>
                </ScrollArea>
                <SheetFooter className="pt-4 border-t">
                    <SheetClose asChild>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    </SheetClose>
                    <Button type="submit" onClick={handleSave}>Save changes</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
