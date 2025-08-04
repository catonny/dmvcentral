
"use client";

import * as React from "react";
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc, orderBy, writeBatch, getDocs, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Employee, EmployeeRole, Department } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, PlusCircle, ArrowLeft } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { EditEmployeeSheet } from "@/components/employee/edit-employee-sheet";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EditDepartmentDialog } from "@/components/employee/edit-department-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// Draggable Employee Member Component
function DraggableEmployeeMember({ member, role }: { member: Employee, role: EmployeeRole }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: `${member.id}_${role}` }); // Unique ID for each draggable instance

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <Card className="p-4 flex flex-col items-center justify-center text-center touch-none">
                <Avatar className="w-16 h-16 mb-4">
                    <AvatarImage src={member.avatar} alt={member.name} />
                    <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <p className="font-semibold">{member.name}</p>
                <p className="text-sm text-muted-foreground">{member.designation || 'N/A'}</p>
                <p className="text-xs text-muted-foreground mt-1">{member.email}</p>
            </Card>
        </div>
    );
}

// Droppable Role Group Component
function DroppableRoleGroup({ role, members }: { role: Department, members: Employee[] }) {
    const { setNodeRef } = useSortable({ id: role.name, disabled: true });
    
    return (
        <Card ref={setNodeRef}>
            <CardHeader>
                <CardTitle>{role.name}</CardTitle>
                <CardDescription>
                    There {members.length === 1 ? 'is' : 'are'} {members.length} {members.length === 1 ? 'member' : 'members'} with this role.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <SortableContext items={members.map(m => `${m.id}_${role.name}`)} strategy={verticalListSortingStrategy}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {members.map(member => (
                            <DraggableEmployeeMember key={`${member.id}_${role.name}`} member={member} role={role.name} />
                        ))}
                    </div>
                </SortableContext>
            </CardContent>
        </Card>
    );
}

export function EmployeeManager({ onBack }: { onBack: () => void }) {
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isEmployeeSheetOpen, setIsEmployeeSheetOpen] = React.useState(false);
  const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null);
  const [isDeptDialogOpen, setIsDeptDialogOpen] = React.useState(false);
  const [selectedDept, setSelectedDept] = React.useState<Department | null>(null);
  
  const { toast } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    setLoading(true);

    const employeeQuery = query(collection(db, "employees"));
    const deptsQuery = query(collection(db, "departments"), orderBy("order"));
    
    const unsubEmployees = onSnapshot(employeeQuery, (snapshot) => {
      const employeeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(employeeData);
    }, (error) => {
      console.error("Error fetching employee data: ", error);
      toast({ title: "Error", description: "Failed to load employee data.", variant: "destructive" });
    });

    const unsubDepts = onSnapshot(deptsQuery, (snapshot) => {
        const deptsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
        setDepartments(deptsData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching departments: ", error);
        toast({ title: "Error", description: "Failed to load departments.", variant: "destructive" });
        setLoading(false);
    });

    return () => {
        unsubEmployees();
        unsubDepts();
    };
  }, [toast]);

  const groupedEmployees = React.useMemo(() => {
    const employeeByDept: { [key: string]: Employee[] } = {};
    
    // Initialize all departments with empty arrays
    departments.forEach(dept => {
        employeeByDept[dept.name] = [];
    });

    // Populate with employees
    employees.forEach(member => {
        const roles = Array.isArray(member.role) ? member.role : [member.role].filter(Boolean);
        roles.forEach(roleName => {
            if (employeeByDept[roleName]) {
                employeeByDept[roleName].push(member);
            }
        });
    });

    return departments.map(dept => ({
        role: dept,
        members: employeeByDept[dept.name] || []
    }));
  }, [employees, departments]);

  const handleOpenEmployeeSheet = (employee: Employee | null) => {
    setSelectedEmployee(employee);
    setIsEmployeeSheetOpen(true);
  };

  const handleCloseEmployeeSheet = () => {
    setIsEmployeeSheetOpen(false);
    setSelectedEmployee(null);
  };

  const handleSaveEmployee = async (employeeData: Partial<Employee>) => {
    try {
      if (selectedEmployee?.id) {
        const employeeRef = doc(db, "employees", selectedEmployee.id);
        await updateDoc(employeeRef, employeeData);
        toast({ title: "Success", description: "Employee member updated successfully." });
      } else {
        await addDoc(collection(db, "employees"), employeeData);
        toast({ title: "Success", description: "New employee added." });
      }
      handleCloseEmployeeSheet();
    } catch (error) {
      console.error("Error saving employee:", error);
      toast({ title: "Error", description: "Failed to save employee data.", variant: "destructive" });
    }
  };

  const handleOpenDeptDialog = (dept: Department | null) => {
    setSelectedDept(dept);
    setIsDeptDialogOpen(true);
  }

  const handleCloseDeptDialog = () => {
    setIsDeptDialogOpen(false);
    setSelectedDept(null);
  }

  const handleSaveDept = async (deptData: { id?: string; name: string }) => {
    try {
        if (deptData.id) { // Editing existing department
            const deptRef = doc(db, "departments", deptData.id);
            await updateDoc(deptRef, { name: deptData.name });
            toast({ title: "Success", description: "Department updated." });
        } else { // Adding new department
            const newDeptRef = doc(collection(db, "departments"));
            const newOrder = departments.length > 0 ? Math.max(...departments.map(d => d.order)) + 1 : 1;
            await setDoc(newDeptRef, { id: newDeptRef.id, name: deptData.name, order: newOrder });
            toast({ title: "Success", description: "New department added." });
        }
        handleCloseDeptDialog();
    } catch (error) {
        console.error("Error saving department:", error);
        toast({ title: "Error", description: "Failed to save department.", variant: "destructive" });
    }
  }

  const handleDeleteDept = async (deptId: string) => {
    try {
        // You might want to add logic here to prevent deleting a department that has employees
        await deleteDoc(doc(db, "departments", deptId));
        toast({ title: "Success", description: "Department deleted." });
    } catch (error) {
        console.error("Error deleting department:", error);
        toast({ title: "Error", description: "Failed to delete department.", variant: "destructive" });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
  
    if (over && active.id !== over.id) {
        const activeId = String(active.id).split('_')[0];
        const activeEmployee = employees.find(s => s.id === activeId);
        
        let newRole: EmployeeRole | undefined;
        // Check if dropping onto a role group directly
        const overIsRoleGroup = departments.some(d => d.name === over.id);
        if (overIsRoleGroup) {
            newRole = over.id as EmployeeRole;
        } else {
            // Check if dropping onto an employee card
            const overEmployeeId = String(over.id).split('_')[0];
            const overEmployeeMember = employees.find(s => s.id === overEmployeeId);
            if (overEmployeeMember) {
                // Find the department of the employee being dropped onto
                const overRoleString = String(over.id).split('_')[1];
                const dept = departments.find(d => d.name === overRoleString);
                if (dept) {
                    newRole = dept.name;
                }
            }
        }
       
        if (activeEmployee && newRole) {
            const currentRoles = Array.isArray(activeEmployee.role) ? activeEmployee.role : [activeEmployee.role].filter(Boolean);
            if (!currentRoles.includes(newRole)) {
                const updatedRoles = [...currentRoles, newRole];
                
                // Optimistic UI update
                setEmployees((prevEmployees) => 
                    prevEmployees.map(s => 
                        s.id === activeId ? { ...s, role: updatedRoles } : s
                    )
                );
                
                const employeeRef = doc(db, "employees", activeId);
                try {
                    await updateDoc(employeeRef, { role: updatedRoles });
                    toast({
                        title: "Employee Role Updated",
                        description: `${activeEmployee.name} was added to the ${newRole} department.`,
                    });
                } catch (error) {
                    console.error("Error updating employee role:", error);
                    toast({
                        title: "Update Failed",
                        description: "Could not update the employee's role.",
                        variant: "destructive",
                    });
                    // Revert UI on failure
                    setEmployees(employees);
                }
            }
        }
    }
  }

  if (loading) {
    return <div className="flex h-full w-full items-center justify-center">Loading employees...</div>;
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={onBack} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Actions
      </Button>
      <div className="flex items-center justify-between space-y-2 mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Employee Management</h2>
          <p className="text-muted-foreground">
            View and manage your team's roles and hierarchy.
          </p>
        </div>
        <Button onClick={() => handleOpenEmployeeSheet(null)}>
            <PlusCircle />
            Add Employee
        </Button>
      </div>

      <Tabs defaultValue="hierarchy" className="space-y-4">
        <TabsList>
          <TabsTrigger value="hierarchy">Hierarchy View</TabsTrigger>
          <TabsTrigger value="table">Table View</TabsTrigger>
        </TabsList>
        <TabsContent value="hierarchy" className="space-y-6">
           <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div className="space-y-6">
                    {groupedEmployees.map(({ role, members }) => (
                         <DroppableRoleGroup key={role.id} role={role} members={members} />
                    ))}
                </div>
            </DndContext>
        </TabsContent>
        <TabsContent value="table" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Employee List</CardTitle>
                    <CardDescription>A complete list of all employees.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="w-full whitespace-nowrap">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {employees.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell className="font-medium">{member.name}</TableCell>
                                        <TableCell>{member.designation || 'N/A'}</TableCell>
                                        <TableCell>{Array.isArray(member.role) ? member.role.join(', ') : member.role}</TableCell>
                                        <TableCell>{member.email}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleOpenEmployeeSheet(member)}>
                                                        Edit Employee
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Departments</CardTitle>
                        <CardDescription>A list of all roles and the number of employees in each.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleOpenDeptDialog(null)}>
                        <PlusCircle />
                        Add Department
                    </Button>
                </CardHeader>
                <CardContent>
                     <ScrollArea className="w-full whitespace-nowrap">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Department Name</TableHead>
                                    <TableHead>Number of Members</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupedEmployees.map(({ role, members }) => (
                                    <TableRow key={role.id}>
                                        <TableCell className="font-medium">{role.name}</TableCell>
                                        <TableCell>{members.length}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleOpenDeptDialog(role)}>
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This will permanently delete the department. This action cannot be undone.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteDept(role.id)} className="bg-destructive hover:bg-destructive/90">
                                                                    Delete
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
      <EditEmployeeSheet
        isOpen={isEmployeeSheetOpen}
        onClose={handleCloseEmployeeSheet}
        onSave={handleSaveEmployee}
        employee={selectedEmployee}
        departments={departments}
      />
      <EditDepartmentDialog
        isOpen={isDeptDialogOpen}
        onClose={handleCloseDeptDialog}
        onSave={handleSaveDept}
        department={selectedDept}
      />
    </>
  );
}
