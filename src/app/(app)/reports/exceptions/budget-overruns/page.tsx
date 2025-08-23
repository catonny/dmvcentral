

"use client";

import * as React from "react";
import { collection, query, onSnapshot, getDocs, doc, setDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Engagement, Employee, Timesheet, EngagementType, Client } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, Bot } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ReportData {
    engagement: Engagement;
    clientName: string;
    totalLoggedHours: number;
    budgetedHours: number;
    hourDifference: number;
    calculatedCost: number;
    invoiceAmount: number;
    profitOrLoss: number;
}

export default function BudgetVsActualsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [reportData, setReportData] = React.useState<ReportData[]>([]);
    const [allPartners, setAllPartners] = React.useState<Employee[]>([]);
    const [selectedPartnerId, setSelectedPartnerId] = React.useState<string>("all");

    React.useEffect(() => {
        const fetchStaticData = async () => {
            const partnersQuery = query(collection(db, "employees"), where("role", "array-contains", "Partner"));
            const partnerSnapshot = await getDocs(partnersQuery);
            setAllPartners(partnerSnapshot.docs.map(d => d.data() as Employee));
        };
        fetchStaticData();
    }, []);

    React.useEffect(() => {
        setLoading(true);
        const unsubEngagements = onSnapshot(collection(db, "engagements"), (engSnap) => {
            const unsubTypes = onSnapshot(collection(db, "engagementTypes"), (typeSnap) => {
                const unsubTimesheets = onSnapshot(collection(db, "timesheets"), (timeSnap) => {
                    const unsubClients = onSnapshot(collection(db, "clients"), async (clientSnap) => {
                        const unsubEmployees = onSnapshot(collection(db, "employees"), (empSnap) => {

                            const engagements = engSnap.docs.map(d => d.data() as Engagement).filter(e => e.fees && e.fees > 0);
                            const engagementTypes = new Map(typeSnap.docs.map(d => [d.id, d.data() as EngagementType]));
                            const timesheets = timeSnap.docs.map(d => d.data() as Timesheet);
                            const clients = new Map(clientSnap.docs.map(d => [d.id, d.data() as Client]));
                            const employees = new Map(empSnap.docs.map(d => [d.id, d.data() as Employee]));
                            
                            const hoursByEngagement: Record<string, { total: number, byUser: Record<string, number> }> = {};
                            timesheets.forEach(ts => {
                                ts.entries.forEach(entry => {
                                    if (!hoursByEngagement[entry.engagementId]) {
                                        hoursByEngagement[entry.engagementId] = { total: 0, byUser: {} };
                                    }
                                    hoursByEngagement[entry.engagementId].total += entry.hours;
                                    hoursByEngagement[entry.engagementId].byUser[ts.userId] = (hoursByEngagement[entry.engagementId].byUser[ts.userId] || 0) + entry.hours;
                                });
                            });

                            const data = engagements.map(eng => {
                                const client = clients.get(eng.clientId);
                                if (!client) return null;

                                const engagementType = engagementTypes.get(eng.type);
                                const budgetedHours = eng.budgetedHours || engagementType?.standardHours || 0;
                                const loggedHoursData = hoursByEngagement[eng.id] || { total: 0, byUser: {} };
                                
                                const calculatedCost = Object.entries(loggedHoursData.byUser).reduce((acc, [userId, hours]) => {
                                    const employee = employees.get(userId);
                                    const chargeOutRate = employee?.chargeOutRate || 0;
                                    return acc + (hours * chargeOutRate);
                                }, 0);
                                
                                const invoiceAmount = eng.fees || 0;
                                const profitOrLoss = invoiceAmount - calculatedCost;
                                const hourDifference = loggedHoursData.total - budgetedHours;

                                return {
                                    engagement: eng,
                                    clientName: client.name,
                                    totalLoggedHours: loggedHoursData.total,
                                    budgetedHours,
                                    hourDifference,
                                    calculatedCost,
                                    invoiceAmount,
                                    profitOrLoss
                                };
                            }).filter((item): item is ReportData => item !== null);
                            
                            setReportData(data);
                            setLoading(false);
                        });
                        return () => unsubEmployees();
                    });
                     return () => unsubClients();
                });
                 return () => unsubTimesheets();
            });
             return () => unsubTypes();
        });
        return () => unsubEngagements();
    }, []);
    
    const filteredReportData = React.useMemo(() => {
        if (selectedPartnerId === 'all') {
            return reportData;
        }
        return reportData.filter(item => {
            const clientPartnerId = item.engagement.reportedTo;
            return clientPartnerId === selectedPartnerId;
        });
    }, [reportData, selectedPartnerId]);


    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
             <Button variant="outline" size="sm" onClick={() => router.push('/reports')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Reports
            </Button>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Budget vs Actuals Report</CardTitle>
                            <CardDescription>Analyze engagement profitability by comparing invoiced fees against the cost of hours logged.</CardDescription>
                        </div>
                        <div className="grid gap-2">
                             <Label>Filter by Partner</Label>
                            <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Select Partner..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Partners</SelectItem>
                                    {allPartners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Engagement</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead className="text-right">Logged Hours</TableHead>
                                <TableHead className="text-right">Hour Difference</TableHead>
                                <TableHead className="text-right">Calculated Cost (Charge-out)</TableHead>
                                <TableHead className="text-right">Invoice Amount</TableHead>
                                <TableHead className="text-right">Profit / (Loss)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredReportData.length > 0 ? (
                                filteredReportData.map(item => (
                                    <TableRow key={item.engagement.id}>
                                        <TableCell>
                                            <Link href={`/workflow/${item.engagement.id}`} className="font-medium hover:underline text-primary">
                                                {item.engagement.remarks}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{item.clientName}</TableCell>
                                        <TableCell className="text-right font-mono">{item.totalLoggedHours.toFixed(1)} / {item.budgetedHours.toFixed(1)}</TableCell>
                                        <TableCell className={cn("text-right font-mono", item.hourDifference > 0 && "text-destructive")}>
                                            {item.hourDifference.toFixed(1)} hrs
                                        </TableCell>
                                        <TableCell className="text-right font-mono">₹{item.calculatedCost.toLocaleString()}</TableCell>
                                        <TableCell className="text-right font-mono">₹{item.invoiceAmount.toLocaleString()}</TableCell>
                                        <TableCell className={cn("text-right font-mono font-bold", item.profitOrLoss > 0 ? "text-green-500" : "text-destructive")}>
                                            {item.profitOrLoss < 0 ? `(₹${Math.abs(item.profitOrLoss).toLocaleString()})` : `₹${item.profitOrLoss.toLocaleString()}`}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24">No billable engagements found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                     </Table>
                </CardContent>
            </Card>
        </div>
    )
}
