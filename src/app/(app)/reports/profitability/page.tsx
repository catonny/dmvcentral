
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Engagement, Employee, Client, Department } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Edit } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { EditEmployeeSheet } from "@/components/employee/edit-employee-sheet";

const EditableCell = ({
  employeeId,
  field,
  initialValue,
  onUpdate,
  type = "number"
}: {
  employeeId: string;
  field: keyof Employee;
  initialValue: number;
  onUpdate: (employeeId: string, field: keyof Employee, value: number) => void;
  type?: "number" | "text";
}) => {
  const [value, setValue] = React.useState(initialValue || 0);
  const debouncedValue = useDebounce(value, 1000);

  React.useEffect(() => {
    setValue(initialValue || 0);
  }, [initialValue]);

  React.useEffect(() => {
    if (debouncedValue !== initialValue) {
      onUpdate(employeeId, field, debouncedValue);
    }
  }, [debouncedValue, initialValue, employeeId, field, onUpdate]);

  return (
    <Input
      type={type}
      value={value}
      onChange={(e) => setValue(Number(e.target.value) || 0)}
      className="w-32 text-right font-mono bg-transparent border-input hover:border-primary focus:ring-primary"
    />
  );
};


export default function ProfitabilityReportPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    
    const [employees, setEmployees] = React.useState<Employee[]>([]);
    const [departments, setDepartments] = React.useState<Department[]>([]);
    
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null);

    React.useEffect(() => {
        if (!user) {
             setLoading(false);
             return;
        }
        
        const checkUserRole = async () => {
            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const employeeSnapshot = await getDocs(employeeQuery);
            if (!employeeSnapshot.empty) {
                const employeeData = employeeSnapshot.docs[0].data() as Employee;
                if (employeeData.role.includes("Partner") || employeeData.role.includes("Admin")) {
                    setHasAccess(true);
                }
            }
             setLoading(false);
        };
        checkUserRole();
    }, [user]);

    React.useEffect(() => {
        if (!hasAccess) return;

        const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
            setEmployees(snapshot.docs.map(doc => doc.data() as Employee));
        });
        const unsubDepts = onSnapshot(collection(db, "departments"), (snapshot) => {
            setDepartments(snapshot.docs.map(doc => doc.data() as Department));
        });

        return () => {
            unsubEmployees();
            unsubDepts();
        };
    }, [hasAccess]);
    
    const handleUpdateEmployee = async (employeeId: string, field: keyof Employee, value: number) => {
        const docRef = doc(db, "employees", employeeId);
        try {
            await updateDoc(docRef, { [field]: value });
            toast({ title: "Success", description: "Employee data updated." });
        } catch (error) {
            console.error(`Error updating employee ${field}:`, error);
            toast({ title: "Error", description: "Failed to update employee.", variant: "destructive" });
        }
    };
    
    const handleSaveEmployeeSheet = async (data: Partial<Employee>) => {
        if (!selectedEmployee) return;
        await handleUpdateEmployee(selectedEmployee.id, 'monthlySalary', data.monthlySalary || 0);
        await handleUpdateEmployee(selectedEmployee.id, 'chargeOutRate', data.chargeOutRate || 0);
        setIsSheetOpen(false);
    }
    
    const departmentMap = React.useMemo(() => new Map(departments.map(d => [d.name, d])), [departments]);
    
    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!hasAccess) {
        return (
            <Card>
                <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
                <CardContent><p>You do not have permission to view this page.</p></CardContent>
            </Card>
        );
    }


    return (
        <div className="space-y-6">
            <Button variant="outline" size="sm" onClick={() => router.push('/reports')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Reports
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>Profitability & Rate Card</CardTitle>
                    <CardDescription>
                        Manage employee costs and define billable charge-out rates for profitability analysis.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead className="text-right">Weekly Hours</TableHead>
                                <TableHead className="text-right">Cost Per Week (₹)</TableHead>
                                <TableHead className="text-right">Markup (%)</TableHead>
                                <TableHead className="text-right">Charge-Out Rate (₹/hr)</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {employees.map(emp => {
                                const dept = departmentMap.get(emp.role[0]);
                                const weeklyHours = dept?.standardWeeklyHours || 40;
                                const costPerWeek = (emp.monthlySalary || 0) * 12 / 52;
                                const costPerHour = weeklyHours > 0 ? costPerWeek / weeklyHours : 0;
                                const chargeOutRate = emp.chargeOutRate || 0;
                                const markup = costPerHour > 0 ? ((chargeOutRate - costPerHour) / costPerHour) * 100 : 0;

                                return (
                                    <TableRow key={emp.id}>
                                        <TableCell className="font-medium">{emp.name}</TableCell>
                                        <TableCell>{emp.role.join(", ")}</TableCell>
                                        <TableCell className="text-right">{weeklyHours}</TableCell>
                                        <TableCell className="text-right font-mono">{costPerWeek.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-mono">{markup.toFixed(2)}%</TableCell>
                                        <TableCell className="text-right">
                                             <EditableCell
                                                employeeId={emp.id}
                                                field="chargeOutRate"
                                                initialValue={emp.chargeOutRate || 0}
                                                onUpdate={handleUpdateEmployee}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => {setSelectedEmployee(emp); setIsSheetOpen(true);}}>
                                                <Edit className="h-4 w-4"/>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
             <EditEmployeeSheet
                isOpen={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                employee={selectedEmployee}
                onSave={handleSaveEmployeeSheet}
                departments={departments}
            />
        </div>
    );
}
