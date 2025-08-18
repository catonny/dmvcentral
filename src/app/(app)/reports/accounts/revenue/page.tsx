
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { ArrowLeft, CalendarIcon, Download, PiggyBank, CircleDollarSign, Hourglass, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { DateRange } from "react-day-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, Firm, Client, EngagementType, Engagement } from "@/lib/data";
import Papa from "papaparse";

const KpiCard = ({ title, value, icon: Icon }: { title: string, value: string, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
)

type GroupBy = "none" | "client" | "engagementType";

export default function RevenueReportPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    
    // Master Data
    const [allInvoices, setAllInvoices] = React.useState<Invoice[]>([]);
    const [allFirms, setAllFirms] = React.useState<Firm[]>([]);
    const [allClients, setAllClients] = React.useState<Map<string, Client>>(new Map());
    const [allEngagements, setAllEngagements] = React.useState<Map<string, Engagement>>(new Map());
    const [allEngagementTypes, setAllEngagementTypes] = React.useState<Map<string, EngagementType>>(new Map());

    // Filter State
    const [selectedFirmId, setSelectedFirmId] = React.useState<string>("all");
    const [groupBy, setGroupBy] = React.useState<GroupBy>("none");
    const [date, setDate] = React.useState<DateRange | undefined>({
        from: addDays(new Date(), -90),
        to: new Date(),
    });

    React.useEffect(() => {
        const unsubs = [
            onSnapshot(collection(db, "invoices"), (snap) => setAllInvoices(snap.docs.map(d => d.data() as Invoice)), (e) => toast({variant: 'destructive', title: "Error", description: "Failed to fetch invoices."})),
            onSnapshot(collection(db, "firms"), (snap) => setAllFirms(snap.docs.map(d => d.data() as Firm)), (e) => toast({variant: 'destructive', title: "Error", description: "Failed to fetch firms."})),
            onSnapshot(collection(db, "clients"), (snap) => setAllClients(new Map(snap.docs.map(d => [d.id, d.data() as Client]))), (e) => toast({variant: 'destructive', title: "Error", description: "Failed to fetch clients."})),
            onSnapshot(collection(db, "engagements"), (snap) => setAllEngagements(new Map(snap.docs.map(d => [d.id, d.data() as Engagement]))), (e) => toast({variant: 'destructive', title: "Error", description: "Failed to fetch engagements."})),
            onSnapshot(collection(db, "engagementTypes"), (snap) => setAllEngagementTypes(new Map(snap.docs.map(d => [d.id, d.data() as EngagementType]))), (e) => toast({variant: 'destructive', title: "Error", description: "Failed to fetch engagement types."})),
        ];

        setLoading(false);
        return () => unsubs.forEach(unsub => unsub());
    }, [toast]);

    const filteredInvoices = React.useMemo(() => {
        return allInvoices.filter(inv => {
            const issueDate = parseISO(inv.issueDate);
            const dateMatch = date?.from && date?.to ? issueDate >= date.from && issueDate <= date.to : true;
            const firmMatch = selectedFirmId === 'all' || inv.firmId === selectedFirmId;
            return dateMatch && firmMatch;
        });
    }, [allInvoices, date, selectedFirmId]);
    
    const kpiData = React.useMemo(() => {
        let totalRevenue = 0;
        let totalCollected = 0;
        let totalPending = 0;

        filteredInvoices.forEach(inv => {
            if (inv.status !== 'Cancelled') {
                totalRevenue += inv.totalAmount;
                if (inv.status === 'Paid') {
                    totalCollected += inv.totalAmount;
                } else {
                    totalPending += inv.totalAmount;
                }
            }
        });
        return { totalRevenue, totalCollected, totalPending };
    }, [filteredInvoices]);

    const groupedData = React.useMemo(() => {
        if (groupBy === 'none') return null;

        const groups: { [key: string]: { name: string; revenue: number; collected: number; pending: number; } } = {};

        filteredInvoices.forEach(inv => {
            if (inv.status === 'Cancelled') return;

            let groupKey = '';
            let groupName = 'Uncategorized';

            if (groupBy === 'client') {
                groupKey = inv.clientId;
                groupName = allClients.get(inv.clientId)?.name || 'Unknown Client';
            } else if (groupBy === 'engagementType') {
                const engagement = allEngagements.get(inv.engagementId);
                groupKey = engagement?.type || 'unknown';
                groupName = allEngagementTypes.get(engagement?.type || '')?.name || 'Unknown Type';
            }

            if (!groups[groupKey]) {
                groups[groupKey] = { name: groupName, revenue: 0, collected: 0, pending: 0 };
            }
            groups[groupKey].revenue += inv.totalAmount;
            if (inv.status === 'Paid') {
                groups[groupKey].collected += inv.totalAmount;
            } else {
                groups[groupKey].pending += inv.totalAmount;
            }
        });
        return Object.values(groups).sort((a, b) => b.revenue - a.revenue);

    }, [groupBy, filteredInvoices, allClients, allEngagements, allEngagementTypes]);

    const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const handleExport = () => {
        if (!groupedData) {
            toast({ title: "Cannot Export", description: "Please select a 'Group By' option to export data.", variant: "destructive"});
            return;
        }
        const csv = Papa.unparse(groupedData.map(item => ({
            "Group": item.name,
            "Total Revenue": item.revenue,
            "Collected": item.collected,
            "Pending": item.pending,
        })));
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `revenue_report_${groupBy}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6">
            <Button variant="outline" size="sm" onClick={() => router.push('/reports/accounts')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Accounts Reports
            </Button>

            <Card>
                <CardHeader>
                    <CardTitle>Revenue Report</CardTitle>
                    <CardDescription>Analyze revenue, collections, and pending amounts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 grid gap-4 items-end grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            <div className="grid gap-2">
                                <Label>Firm</Label>
                                <Select value={selectedFirmId} onValueChange={setSelectedFirmId}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Firms</SelectItem>
                                        {allFirms.map(firm => <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Date Range</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        className={cn("w-full justify-start text-left font-normal",!date && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>) : (format(date.from, "LLL dd, y"))) : (<span>Pick a date range</span>)}
                                    </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={date?.from}
                                        selected={date}
                                        onSelect={setDate}
                                        numberOfMonths={2}
                                    />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="flex gap-2 items-end">
                                <Button variant="outline" className="w-full" onClick={() => setDate({from: startOfMonth(new Date()), to: endOfMonth(new Date())})}>This Month</Button>
                                <Button variant="outline" className="w-full" onClick={() => setDate({from: startOfQuarter(new Date()), to: endOfQuarter(new Date())})}>This Quarter</Button>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Group By</Label>
                                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="client">Client</SelectItem>
                                    <SelectItem value="engagementType">Engagement Type</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <KpiCard title="Total Revenue" value={formatCurrency(kpiData.totalRevenue)} icon={CircleDollarSign} />
                        <KpiCard title="Total Collected" value={formatCurrency(kpiData.totalCollected)} icon={PiggyBank} />
                        <KpiCard title="Total Pending" value={formatCurrency(kpiData.totalPending)} icon={Hourglass} />
                    </div>
                    
                    <div className="flex justify-end">
                        <Button onClick={handleExport} disabled={!groupedData}>
                            <Download className="mr-2 h-4 w-4" />
                            Export to CSV
                        </Button>
                    </div>

                    <ScrollArea className="h-96 w-full rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{groupBy !== 'none' ? capitalizeFirstLetter(groupBy) : 'Group'}</TableHead>
                                    <TableHead className="text-right">Revenue</TableHead>
                                    <TableHead className="text-right">Collected</TableHead>
                                    <TableHead className="text-right">Pending</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                ) : groupedData ? (
                                    groupedData.length > 0 ? (
                                        groupedData.map(item => (
                                            <TableRow key={item.name}>
                                                <TableCell className="font-medium">{item.name}</TableCell>
                                                <TableCell className="text-right font-mono">{formatCurrency(item.revenue)}</TableCell>
                                                <TableCell className="text-right font-mono">{formatCurrency(item.collected)}</TableCell>
                                                <TableCell className="text-right font-mono">{formatCurrency(item.pending)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No data for the selected filters.</TableCell></TableRow>
                                    )
                                ) : (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Select a 'Group By' option to see detailed data.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}

function capitalizeFirstLetter(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
