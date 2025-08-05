
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, doc, updateDoc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { LeaveRequest, Employee } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format, differenceInBusinessDays, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X } from "lucide-react";

export default function LeaveManagementPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [leaveRequests, setLeaveRequests] = React.useState<LeaveRequest[]>([]);
    const [currentUserEmployee, setCurrentUserEmployee] = React.useState<Employee | null>(null);
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);

    React.useEffect(() => {
        if (!user) return;

        const checkUserRole = async () => {
            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const employeeSnapshot = await getDocs(employeeQuery);

            if (!employeeSnapshot.empty) {
                const employeeData = { id: employeeSnapshot.docs[0].id, ...employeeSnapshot.docs[0].data() } as Employee;
                setCurrentUserEmployee(employeeData);
                if (employeeData.role.includes("Partner") || employeeData.role.includes("Manager") || employeeData.role.includes("Admin")) {
                    setHasAccess(true);
                }
            }
             // Also fetch all employees for manager filtering
            const allEmployeesSnapshot = await getDocs(collection(db, "employees"));
            setAllEmployees(allEmployeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));

            setLoading(false);
        };
        checkUserRole();
    }, [user]);

    React.useEffect(() => {
        if (!hasAccess || !currentUserEmployee) return;
        
        // Admins/Partners see all requests. Managers only see requests from employees who report to them.
        let leaveQuery;
        if (currentUserEmployee.role.includes("Admin") || currentUserEmployee.role.includes("Partner")) {
            leaveQuery = query(collection(db, "leaveRequests"), where("status", "==", "Pending"));
        } else { // Manager
            const managedEmployeeIds = allEmployees.filter(e => e.managerId === currentUserEmployee.id).map(e => e.id);
            if (managedEmployeeIds.length > 0) {
                 leaveQuery = query(
                    collection(db, "leaveRequests"), 
                    where("status", "==", "Pending"),
                    where("employeeId", "in", managedEmployeeIds)
                );
            }
        }
        
        if (!leaveQuery) {
            setLeaveRequests([]);
            return;
        }

        const unsubscribe = onSnapshot(leaveQuery, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({...doc.data(), id: doc.id } as LeaveRequest));
            setLeaveRequests(requests);
        });

        return () => unsubscribe();

    }, [hasAccess, currentUserEmployee, allEmployees]);

    const handleLeaveUpdate = async (requestId: string, status: "Approved" | "Rejected") => {
        if (!currentUserEmployee) return;

        try {
            const requestRef = doc(db, "leaveRequests", requestId);
            await updateDoc(requestRef, {
                status: status,
                approvedBy: currentUserEmployee.id,
            });

            if (status === "Approved") {
                const request = leaveRequests.find(r => r.id === requestId);
                if (request) {
                    const employeeRef = doc(db, "employees", request.employeeId);
                    const employeeSnap = await getDoc(employeeRef);
                    if (employeeSnap.exists()) {
                        const employeeData = employeeSnap.data() as Employee;
                        const leaveDays = differenceInBusinessDays(parseISO(request.endDate), parseISO(request.startDate)) + 1;
                        const newLeavesTaken = (employeeData.leavesTaken || 0) + leaveDays;
                        await updateDoc(employeeRef, { leavesTaken: newLeavesTaken });
                    }
                }
                // Here you would trigger the AI agent flow
            }

            toast({ title: "Success", description: `Leave request has been ${status.toLowerCase()}.` });
        } catch (error) {
            console.error("Error updating leave request:", error);
            toast({ title: "Error", description: "Failed to update leave request.", variant: "destructive" });
        }
    };

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
                <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
                <CardContent><p>You do not have the required permissions to view this page.</p></CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">Leave Management</h2>
                    <p className="text-muted-foreground">
                        Review and act on pending employee leave requests.
                    </p>
                </div>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Pending Requests</CardTitle>
                    <CardDescription>The following leave requests are awaiting your approval.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Dates Requested</TableHead>
                                <TableHead>Total Days</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {leaveRequests.length > 0 ? leaveRequests.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell className="font-medium">{req.employeeName}</TableCell>
                                    <TableCell>
                                        {format(parseISO(req.startDate), "dd MMM")} - {format(parseISO(req.endDate), "dd MMM, yyyy")}
                                    </TableCell>
                                    <TableCell>
                                        {differenceInBusinessDays(parseISO(req.endDate), parseISO(req.startDate)) + 1}
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate">{req.reason}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="text-green-500 hover:text-green-600" onClick={() => handleLeaveUpdate(req.id, "Approved")}>
                                            <Check className="h-5 w-5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={() => handleLeaveUpdate(req.id, "Rejected")}>
                                            <X className="h-5 w-5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">No pending leave requests.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
