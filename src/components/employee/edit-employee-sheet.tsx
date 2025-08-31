
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
import type { Employee, EmployeeRole, Department, Engagement, Todo } from "@/lib/data";
import { ScrollArea } from "../ui/scroll-area";
import { Checkbox } from "../ui/checkbox";
import { capitalizeWords } from "@/lib/utils";
import { Switch } from "../ui/switch";
import { collection, doc, getDocs, query, where, writeBatch, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { reallocateEngagements } from "@/ai/flows/reallocate-engagements-flow";

interface EditEmployeeSheetProps {
    employee: Employee | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (updatedEmployee: Partial<Employee>) => Promise<void>;
    departments: Department[];
    allEmployees: Employee[];
}

export function EditEmployeeSheet({ employee, isOpen, onClose, onSave, departments, allEmployees }: EditEmployeeSheetProps) {
    const [formData, setFormData] = React.useState<Partial<Employee>>({});
    const { toast } = useToast();

    React.useEffect(() => {
        if (isOpen) {
            // Ensure role is always an array for consistency
            const initialRoles = employee?.role ? (Array.isArray(employee.role) ? employee.role : [employee.role]) : [];
            const initialIsActive = employee?.isActive === false ? false : true;
            setFormData(employee ? { ...employee, role: initialRoles, isActive: initialIsActive } : {
                name: '',
                email: '',
                role: ['Employee'],
                designation: '',
                monthlySalary: 0,
                chargeOutRate: 0,
                avatar: `https://placehold.co/40x40.png`,
                isActive: true,
            });
        }
    }, [employee, isOpen]);


    const handleSave = async () => {
        if (!formData.name || !formData.email || !formData.role || formData.role.length === 0) {
            toast({ title: "Validation Error", description: "Name, Email, and at least one Role are required.", variant: "destructive" });
            return;
        }

        const dataToSave = {
            ...formData,
            name: capitalizeWords(formData.name),
        };

        // Check if status is changing to inactive
        if (employee && employee.isActive !== false && dataToSave.isActive === false) {
             handleInactivation(employee);
        }

        await onSave(dataToSave);
        onClose();
    }
    
    const handleInactivation = async (inactiveEmployee: Employee) => {
        try {
            toast({ title: "Processing...", description: "AI is analyzing workloads and generating a reallocation plan. This may take a moment." });
            
            // const reallocationResult = await reallocateEngagements({ inactiveEmployeeId: inactiveEmployee.id });
            
            // if (!reallocationResult || reallocationResult.plan.length === 0) {
            //     toast({ title: "No Action Needed", description: "The inactive employee has no active engagements to reallocate." });
            //     return;
            // }

            // const managerId = inactiveEmployee.managerId || 'S001'; // Default to Tonny if no manager
            // const manager = allEmployees.find(e => e.id === managerId);
            
            // // Format the plan into a readable string for the to-do
            // const planText = reallocationResult.plan.map(p => 
            //     `- Reassign "${p.engagementRemarks}" to ${p.newAssigneeName} (Reason: ${p.reasoning})`
            // ).join('\n');

            // const todoText = `Action Required: Reallocate work for inactive employee ${inactiveEmployee.name}. AI has proposed the following plan based on team workload:\n\n${planText}`;

            // const todoRef = doc(collection(db, "todos"));
            // const newTodo: Todo = {
            //     id: todoRef.id,
            //     type: 'BUDGET_OVERRIDE', // Re-using for now, should be a new type 'REALLOCATION_APPROVAL'
            //     text: todoText,
            //     createdBy: "system",
            //     assignedTo: [managerId],
            //     isCompleted: false,
            //     createdAt: new Date().toISOString(),
            //     relatedEntity: { type: 'engagement_creation_request', id: todoRef.id }, // Placeholder
            //     relatedData: { plan: reallocationResult.plan } // Store the plan for future approval action
            // };
            // await setDoc(todoRef, newTodo);

            toast({
                title: "AI Feature Disabled",
                description: `AI Reallocation is temporarily disabled.`,
                variant: "destructive",
                duration: 7000,
            });

        } catch (error) {
            console.error("Error handling inactivation:", error);
            toast({
                title: "Warning",
                description: "Could not automatically generate a reallocation plan. Please manually review the employee's engagements.",
                variant: "destructive",
            });
        }
    };


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
                        <Label htmlFor="chargeOutRate" className="text-right">Charge out Rate Per Hour</Label>
                        <Input id="chargeOutRate" type="number" value={formData.chargeOutRate || 0} onChange={handleChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="avatar" className="text-right">Avatar URL</Label>
                        <Input id="avatar" value={formData.avatar || ''} onChange={handleChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="isActive" className="text-right">Status</Label>
                        <div className="col-span-3 flex items-center gap-2">
                             <Switch
                                id="isActive"
                                checked={formData.isActive}
                                onCheckedChange={(checked) => setFormData({...formData, isActive: checked})}
                            />
                            <span className="text-sm text-muted-foreground">{formData.isActive ? "Active" : "Inactive"}</span>
                        </div>
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
