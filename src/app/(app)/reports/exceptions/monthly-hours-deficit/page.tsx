
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs, doc, setDoc } from "firebase/firestore";
import { db, notify } from "@/lib/firebase";
import type { Employee, Department, Timesheet } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, Bot } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { handlePerformanceReview } from "@/ai/flows/handle-performance-review-flow";

export default function MonthlyHoursDeficitPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [employees, setEmployees] = React.useState<Employee[]>([]);
    const [departments, setDepartments] = React.useState<Map<string, Department>>(new Map());
    const [timesheets, setTimesheets] = React.useState<Timesheet[]>([]);
    const [selectedMonth, setSelectedMonth] = React.useState(format(new Date(), 'yyyy-MM'));
    const [currentUser, setCurrentUser] = React.useState<Employee | null>(null);
    const [processingId, setProcessingId] = React.useState<string | null>(null);

     React.useEffect(() => {
        if(user) {
             getDocs(query(collection(db, "employees"), where("email", "==", user.email)))
                .then(snap => !snap.empty && setCurrentUser(snap.docs[0].data() as Employee));
        }
    }, [user]);

    React.useEffect(() => {
        setLoading(true);
        const unsubEmployees = onSnapshot(collection(db, "employees"), snap => {
            setEmployees(snap.docs.map(doc => doc.data() as Employee));
        });
        const unsubDepts = onSnapshot(collection(db, "departments"), snap => {
            setDepartments(new Map(snap.docs.map(doc => [doc.data().name, doc.data() as Department])));
        });
        const unsubTimesheets = onSnapshot(collection(db, "timesheets"), snap => {
            setTimesheets(snap.docs.map(doc => doc.data() as Timesheet));
            setLoading(false);
        });

        return () => {
            unsubEmployees();
            unsubDepts();
            unsubTimesheets();
        }
    }, []);

    const monthOptions = React.useMemo(() => {
        const earliestDate = timesheets.reduce((earliest, ts) => {
            const tsDate = new Date(ts.weekStartDate);
            return tsDate < earliest ? tsDate : earliest;
        }, new Date());

        if (!timesheets.length) {
            return [{ value: format(new Date(), 'yyyy-MM'), label: format(new Date(), 'MMMM yyyy') }];
        }

        const months = eachMonthOfInterval({ start: earliestDate, end: new Date() });
        return months.map(month => ({
            value: format(month, 'yyyy-MM'),
            label: format(month, 'MMMM yyyy'),
        })).reverse();
    }, [timesheets]);

    const reportData = React.useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const monthStart = startOfMonth(new Date(year, month - 1));
        const monthEnd = endOfMonth(new Date(year, month - 1));

        return employees
            .filter(emp => emp.role[0] && departments.get(emp.role[0])?.standardWeeklyHours)
            .map(emp => {
                const dept = departments.get(emp.role[0])!;
                const targetHours = (dept.standardWeeklyHours || 0) * 4;
                const loggedHours = timesheets
                    .filter(ts => {
                        const tsDate = new Date(ts.weekStartDate);
                        return ts.userId === emp.id && tsDate >= monthStart && tsDate <= monthEnd;
                    })
                    .reduce((sum, ts) => sum + ts.totalHours, 0);

                const deficit = targetHours - loggedHours;

                return {
                    ...emp,
                    targetHours,
                    loggedHours,
                    deficit,
                };
            })
            .filter(emp => emp.deficit > 0)
            .sort((a,b) => b.deficit - a.deficit);
    }, [selectedMonth, employees, departments, timesheets]);
    
    const handleRunAIReview = async (employeeId: string) => {
        if (!currentUser) return;
        setProcessingId(employeeId);
        try {
            // await handlePerformanceReview({ 
            //     employeeId: employeeId,
            //     period: selectedMonth,
            //     reviewerId: currentUser.id
            // });
            toast({
                title: "AI Review Disabled",
                description: "The AI performance review feature is temporarily disabled.",
                variant: "destructive",
            });
        } catch(e) {
            console.error("AI Review failed:", e);
            toast({ title: "Error", description: "Could not run AI performance review.", variant: "destructive" });
        } finally {
            setProcessingId(null);
        }
    }


    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
             <Button variant="outline" size="sm" onClick={() => router.push('/reports/exceptions')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Exception Reports
            </Button>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Monthly Hours Deficit Report</CardTitle>
                            <CardDescription>Employees who have not met their monthly target for billable hours.</CardDescription>
                        </div>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {monthOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead className="text-right">Target Hours</TableHead>
                                <TableHead className="text-right">Logged Hours</TableHead>
                                <TableHead className="text-right">Deficit</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length > 0 ? (
                                reportData.map(emp => (
                                    <TableRow key={emp.id}>
                                        <TableCell>{emp.name}</TableCell>
                                        <TableCell>{emp.role.join(", ")}</TableCell>
                                        <TableCell className="text-right font-mono">{emp.targetHours.toFixed(1)}</TableCell>
                                        <TableCell className="text-right font-mono">{emp.loggedHours.toFixed(1)}</TableCell>
                                        <TableCell className="text-right font-mono text-destructive">{emp.deficit.toFixed(1)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="outline" onClick={() => handleRunAIReview(emp.id)} disabled={processingId === emp.id || true}>
                                                {processingId === emp.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Bot className="mr-2 h-4 w-4" />}
                                                Review with AI (Disabled)
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">All employees met their target hours for {format(new Date(selectedMonth), 'MMMM yyyy')}.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                     </Table>
                </CardContent>
            </Card>
        </div>
    )
}
