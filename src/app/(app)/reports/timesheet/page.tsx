"use client";
import * as React from "react";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Engagement, Employee, Timesheet, Invoice } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Calendar as CalendarIcon, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, parseISO } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface ReportData {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  billedRevenue: number;
  pendingRevenue: number;
  engagements: {
    engagementId: string;
    engagementRemarks: string;
    clientName: string;
    hours: number;
    billStatus?: string;
    fees: number;
  }[];
}

export default function TimesheetReportPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    
    // Master data
    const [employees, setEmployees] = React.useState<Employee[]>([]);
    const [timesheets, setTimesheets] = React.useState<Timesheet[]>([]);
    const [engagements, setEngagements] = React.useState<Engagement[]>([]);
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [clients, setClients] = React.useState<Map<string, any>>(new Map());

    // Filter state
    const [periodType, setPeriodType] = React.useState<"week" | "month">("week");
    const [date, setDate] = React.useState<Date>(new Date());
    
    // Dialog state
    const [isDetailOpen, setIsDetailOpen] = React.useState(false);
    const [selectedEmployeeData, setSelectedEmployeeData] = React.useState<ReportData | null>(null);

    React.useEffect(() => {
        if (!user) return;
        const checkAccess = async () => {
             const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const snapshot = await getDocs(employeeQuery);
            if (!snapshot.empty) {
                const emp = snapshot.docs[0].data() as Employee;
                if(emp.role.includes("Admin") || emp.role.includes("Partner")) {
                    setHasAccess(true);
                }
            }
        };
        checkAccess();
    }, [user]);

    React.useEffect(() => {
        if(!hasAccess) {
            setLoading(false);
            return;
        }

        const unsubEmployees = onSnapshot(collection(db, "employees"), snap => setEmployees(snap.docs.map(d => d.data() as Employee)));
        const unsubTimesheets = onSnapshot(collection(db, "timesheets"), snap => setTimesheets(snap.docs.map(d => d.data() as Timesheet)));
        const unsubEngagements = onSnapshot(collection(db, "engagements"), snap => setEngagements(snap.docs.map(d => d.data() as Engagement)));
        const unsubInvoices = onSnapshot(collection(db, "invoices"), snap => setInvoices(snap.docs.map(d => d.data() as Invoice)));
        const unsubClients = onSnapshot(collection(db, "clients"), snap => setClients(new Map(snap.docs.map(d => [d.id, d.data()]))));

        setLoading(false);

        return () => {
            unsubEmployees();
            unsubTimesheets();
            unsubEngagements();
            unsubInvoices();
            unsubClients();
        };

    }, [hasAccess]);

    const reportData = React.useMemo(() => {
        const startDate = periodType === 'week' ? startOfWeek(date, { weekStartsOn: 1 }) : startOfMonth(date);
        const endDate = periodType === 'week' ? endOfWeek(date, { weekStartsOn: 1 }) : endOfMonth(date);

        const relevantTimesheets = timesheets.filter(ts => {
            const tsDate = parseISO(ts.weekStartDate);
            return tsDate >= startDate && tsDate <= endDate;
        });

        const engagementMap = new Map(engagements.map(e => [e.id, e]));

        const employeeData: { [key: string]: ReportData } = {};

        for (const employee of employees) {
            employeeData[employee.id] = {
                employeeId: employee.id,
                employeeName: employee.name,
                totalHours: 0,
                billedRevenue: 0,
                pendingRevenue: 0,
                engagements: []
            };
        }

        for (const ts of relevantTimesheets) {
            const employee = employeeData[ts.userId];
            if (!employee) continue;

            employee.totalHours += ts.totalHours;

            for(const entry of ts.entries) {
                const engagement = engagementMap.get(entry.engagementId);
                if (!engagement) continue;
                
                const client = clients.get(engagement.clientId);
                const revenue = engagement.fees || 0;
                
                if (engagement.billStatus === "Collected") {
                    employee.billedRevenue += revenue;
                } else if (engagement.billStatus === "To Bill" || engagement.billStatus === "Pending Collection") {
                    employee.pendingRevenue += revenue;
                }
                
                const existingEntry = employee.engagements.find(e => e.engagementId === entry.engagementId);
                if (existingEntry) {
                    existingEntry.hours += entry.hours;
                } else {
                     employee.engagements.push({
                        engagementId: entry.engagementId,
                        engagementRemarks: engagement.remarks,
                        clientName: client?.name || 'Unknown',
                        hours: entry.hours,
                        billStatus: engagement.billStatus || "Not Billed",
                        fees: revenue
                    });
                }
            }
        }
        
        return Object.values(employeeData).filter(e => e.totalHours > 0);

    }, [periodType, date, employees, timesheets, engagements, invoices, clients]);

    const handleOpenDetails = (data: ReportData) => {
        setSelectedEmployeeData(data);
        setIsDetailOpen(true);
    };


    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!hasAccess) {
        return <Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader><CardContent><p>You do not have permission to view this report.</p></CardContent></Card>;
    }


    return (
        <div className="space-y-6">
            <Button variant="outline" size="sm" onClick={() => router.push('/reports')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Reports
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>Timesheet Report</CardTitle>
                    <CardDescription>View employee hours and associated revenue for a selected period.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 mb-6">
                         <Select value={periodType} onValueChange={(v) => setPeriodType(v as any)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="week">Weekly</SelectItem>
                                <SelectItem value="month">Monthly</SelectItem>
                            </SelectContent>
                        </Select>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className="w-[280px] justify-start text-left font-normal">
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {periodType === 'week' ? `Week of ${format(startOfWeek(date, { weekStartsOn: 1 }), "MMM dd, yyyy")}` : format(date, 'MMMM yyyy')}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead className="text-right">Total Hours</TableHead>
                                <TableHead className="text-right">Billed Revenue</TableHead>
                                <TableHead className="text-right">Pending Revenue</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length > 0 ? reportData.map(item => (
                                <TableRow key={item.employeeId} onClick={() => handleOpenDetails(item)} className="cursor-pointer">
                                    <TableCell className="font-medium">{item.employeeName}</TableCell>
                                    <TableCell className="text-right font-mono">{item.totalHours.toFixed(2)}</TableCell>
                                    <TableCell className="text-right font-mono">₹{item.billedRevenue.toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-mono">₹{item.pendingRevenue.toLocaleString()}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">No timesheet data for the selected period.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Detailed View: {selectedEmployeeData?.employeeName}</DialogTitle>
                        <DialogDescription>Engagement-wise breakdown for the selected period.</DialogDescription>
                    </DialogHeader>
                    <div className="h-[60vh] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Engagement</TableHead>
                                    <TableHead className="text-right">Hours Logged</TableHead>
                                    <TableHead className="text-right">Bill Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedEmployeeData?.engagements.map(eng => (
                                    <TableRow key={eng.engagementId}>
                                        <TableCell>{eng.clientName}</TableCell>
                                        <TableCell>{eng.engagementRemarks}</TableCell>
                                        <TableCell className="text-right font-mono">{eng.hours.toFixed(2)}</TableCell>
                                        <TableCell className="text-right"><Badge variant="outline">{eng.billStatus}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
