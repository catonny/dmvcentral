
"use client";

import * as React from "react";
import { collection, onSnapshot, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Bonus, Employee, Engagement, Timesheet, Invoice } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Trophy, Settings, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// NOTE: The bonus calculation logic is now intended to be run by a scheduled backend process monthly.
// This report now simply displays the results logged in the 'bonuses' collection.

export default function BonusReportPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [bonuses, setBonuses] = React.useState<Bonus[]>([]);
    const [employees, setEmployees] = React.useState<Employee[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = React.useState<string>("all");

    React.useEffect(() => {
        if (!user) return;
        
        const checkUserRole = async () => {
            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const employeeSnapshot = await getDocs(employeeQuery);
            if (!employeeSnapshot.empty) {
                const employeeData = employeeSnapshot.docs[0].data() as Employee;
                if (employeeData.role.includes("Partner") || employeeData.role.includes("Admin")) {
                    setHasAccess(true);
                }
            }
        };
        checkUserRole();

    }, [user]);

     React.useEffect(() => {
        if (!hasAccess) {
             setLoading(false);
             return;
        }

        const unsubBonuses = onSnapshot(collection(db, "bonuses"), (snapshot) => {
            setBonuses(snapshot.docs.map(doc => doc.data() as Bonus));
        });
        const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
            setEmployees(snapshot.docs.map(doc => doc.data() as Employee));
            setLoading(false);
        });

        return () => {
            unsubBonuses();
            unsubEmployees();
        }

    }, [hasAccess]);
    
    const employeeMap = React.useMemo(() => new Map(employees.map(e => [e.id, e.name])), [employees]);

    const filteredBonuses = React.useMemo(() => {
        if (selectedEmployeeId === "all") {
            return bonuses;
        }
        return bonuses.filter(b => b.employeeId === selectedEmployeeId);
    }, [bonuses, selectedEmployeeId]);
    
    const summaryData = React.useMemo(() => {
        return employees.map(emp => {
            const empBonuses = bonuses.filter(b => b.employeeId === emp.id);
            const totalBonus = empBonuses.reduce((sum, b) => sum + b.amount, 0);
            return {
                employeeId: emp.id,
                employeeName: emp.name,
                totalBonus
            };
        }).filter(e => e.totalBonus > 0)
        .sort((a,b) => b.totalBonus - a.totalBonus);

    }, [employees, bonuses]);


    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!hasAccess) {
         return (
            <Card>
                <CardHeader>
                    <CardTitle>Access Denied</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>You do not have the required permissions to view this page.</p>
                </CardContent>
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
                    <CardTitle className="flex items-center gap-2"><Trophy/>Employee Bonus Report</CardTitle>
                    <CardDescription>
                        Summary and details of bonuses earned by employees for exceeding monthly performance targets.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                             <CardHeader>
                                <CardTitle>Bonus Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee</TableHead>
                                            <TableHead className="text-right">Total Potential Bonus (₹)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {summaryData.map(item => (
                                            <TableRow key={item.employeeId}>
                                                <TableCell>{item.employeeName}</TableCell>
                                                <TableCell className="text-right font-mono">{item.totalBonus.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                         <Card>
                             <CardHeader>
                                <CardTitle>Detailed Log</CardTitle>
                                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Employee..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Employees</SelectItem>
                                        {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Reason</TableHead>
                                            <TableHead className="text-right">Amount (₹)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredBonuses.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell>{employeeMap.get(item.employeeId)}</TableCell>
                                                <TableCell>{format(parseISO(item.createdAt), "dd MMM, yyyy")}</TableCell>
                                                <TableCell>{item.reason}</TableCell>
                                                <TableCell className="text-right font-mono">{item.amount.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
