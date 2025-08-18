

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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "../ui/badge";

export function EmployeeManager({ onBack }: { onBack: () => void }) {
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isEmployeeSheetOpen, setIsEmployeeSheetOpen] = React.useState(false);
  const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null);
  
  const { toast } = useToast();

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
        const uniqueDepts = Array.from(new Map(deptsData.map(item => [item['id'], item])).values());
        setDepartments(uniqueDepts);
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
  
  if (loading) {
    return <div className="flex h-full w-full items-center justify-center">Loading employees...</div>;
  }

  return (
    <>
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
                              <TableHead>Status</TableHead>
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
                                  <TableCell>
                                    <Badge variant={member.isActive === false ? "destructive" : "default"}>
                                        {member.isActive === false ? "Inactive" : "Active"}
                                    </Badge>
                                  </TableCell>
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
      <EditEmployeeSheet
        isOpen={isEmployeeSheetOpen}
        onClose={handleCloseEmployeeSheet}
        onSave={handleSaveEmployee}
        employee={selectedEmployee}
        departments={departments}
        allEmployees={employees}
      />
    </>
  );
}
