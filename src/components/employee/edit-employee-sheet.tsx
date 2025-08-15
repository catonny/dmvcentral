
"use client";

import * as React from "react";
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
import { useToast } from "@/hooks/use-toast";
import type { Employee, EmployeeRole, Department } from "@/lib/data";
import { ScrollArea } from "../ui/scroll-area";
import { Checkbox } from "../ui/checkbox";

interface EditEmployeeSheetProps {
    employee: Employee | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedEmployee: Partial<Employee>) => Promise<void>;
    departments: Department[];
}

export function EditEmployeeSheet({ employee, isOpen, onClose, onSave, departments }: EditEmployeeSheetProps) {
    const [formData, setFormData] = React.useState<Partial<Employee>>({});
    const { toast } = useToast();

    React.useEffect(() => {
        if (isOpen) {
            // Ensure role is always an array for consistency
            const initialRoles = employee?.role ? (Array.isArray(employee.role) ? employee.role : [employee.role]) : [];
            setFormData(employee ? { ...employee, role: initialRoles } : {
                name: '',
                email: '',
                role: ['Employee'],
                designation: '',
                monthlySalary: 0,
                chargeOutRate: 0,
                avatar: `https://placehold.co/40x40.png`,
            });
        }
    }, [employee, isOpen]);


    const handleSave = async () => {
        if (!formData.name || !formData.email || !formData.role || formData.role.length === 0) {
            toast({ title: "Validation Error", description: "Name, Email, and at least one Role are required.", variant: "destructive" });
            return;
        }
        await onSave(formData);
        onClose();
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value, type } = e.target;
        setFormData({ 
            ...formData, 
            [id]: type === 'number' ? Number(value) : value 
        });
    }

    const handleRoleChange = (roleName: EmployeeRole, isChecked: boolean) => {
        const currentRoles = formData.role || [];
        let newRoles: EmployeeRole[];
        if (isChecked) {
            newRoles = [...currentRoles, roleName];
        } else {
            newRoles = currentRoles.filter(r => r !== roleName);
        }
        setFormData({ ...formData, role: newRoles });
    };


    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>{employee?.id ? 'Edit Employee' : 'Add New Employee'}</SheetTitle>
                    <SheetDescription>
                        {employee?.id ? "Update the employee's details." : "Enter the details for the new employee."}
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-12rem)] pr-6">
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input id="name" value={formData.name || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">Email</Label>
                        <Input id="email" type="email" value={formData.email || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="designation" className="text-right">Designation</Label>
                        <Input id="designation" value={formData.designation || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right pt-2">Roles</Label>
                        <div className="col-span-3 space-y-2">
                            {departments.map((dept) => (
                                <div key={dept.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={`role-${dept.name}`}
                                        checked={(formData.role || []).includes(dept.name)}
                                        onCheckedChange={(checked) => handleRoleChange(dept.name, !!checked)}
                                    />
                                    <Label htmlFor={`role-${dept.name}`} className="font-normal">
                                        {dept.name}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="monthlySalary" className="text-right">Monthly Salary</Label>
                        <Input id="monthlySalary" type="number" value={formData.monthlySalary || 0} onChange={handleChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="chargeOutRate" className="text-right">Charge-Out Rate</Label>
                        <Input id="chargeOutRate" type="number" value={formData.chargeOutRate || 0} onChange={handleChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="avatar" className="text-right">Avatar URL</Label>
                        <Input id="avatar" value={formData.avatar || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                </div>
                </ScrollArea>
                <SheetFooter className="pt-4 border-t">
                    <SheetClose asChild>
                        <Button type="button" variant="outline">Cancel</Button>
                    </SheetClose>
                    <Button type="submit" onClick={handleSave}>Save changes</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
