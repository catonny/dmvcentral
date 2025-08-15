

"use client";

import * as React from "react";
import { collection, query, onSnapshot, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Engagement, Employee, Timesheet, EngagementType } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, Bot } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { handlePerformanceReview } from "@/ai/flows/handle-performance-review-flow";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface OverrunData {
    engagement: Engagement;
    engagementType: EngagementType;
    totalHours: number;
    budgetedHours: number;
    overrun: number;
}

export default function BudgetOverrunsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [reportData, setReportData] = React.useState<OverrunData[]>([]);
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
        const unsubEngagements = onSnapshot(collection(db, "engagements"), (engSnap) => {
            const unsubTypes = onSnapshot(collection(db, "engagementTypes"), (typeSnap) => {
                const unsubTimesheets = onSnapshot(collection(db, "timesheets"), (timeSnap) => {
                    
                    const engagements = engSnap.docs.map(d => d.data() as Engagement);
                    const engagementTypes = new Map(typeSnap.docs.map(d => [d.id, d.data() as EngagementType]));
                    const timesheets = timeSnap.docs.map(d => d.data() as Timesheet);
                    
                    const hoursByEngagement = timesheets.reduce((acc, ts) => {
                        ts.entries.forEach(entry => {
                            acc[entry.engagementId] = (acc[entry.engagementId] || 0) + entry.hours;
                        });
                        return acc;
                    }, {} as Record<string, number>);

                    const overruns = engagements
                        .map(eng => {
                            const engagementType = engagementTypes.get(eng.type);
                            const budgetedHours = eng.budgetedHours || engagementType?.standardHours || 0;
                            if (budgetedHours === 0) return null;

                            const totalHours = hoursByEngagement[eng.id] || 0;
                            const overrun = totalHours - budgetedHours;

                            if (overrun > 5) {
                                return { engagement: eng, engagementType, totalHours, budgetedHours, overrun };
                            }
                            return null;
                        })
                        .filter((item): item is OverrunData => item !== null)
                        .sort((a,b) => b.overrun - a.overrun);

                    setReportData(overruns);
                    setLoading(false);
                });
                return () => unsubTimesheets();
            });
            return () => unsubTypes();
        });
        return () => unsubEngagements();
    }, []);

    const handleRunAIReview = async (engagement: Engagement) => {
        if (!currentUser || !engagement.assignedTo[0]) return;
        setProcessingId(engagement.id);
        try {
            // Since this is about an engagement, we run the review for the primary assignee
            await handlePerformanceReview({ 
                employeeId: engagement.assignedTo[0],
                period: format(new Date(engagement.dueDate), 'yyyy-MM'),
                reviewerId: currentUser.id
            });
            toast({
                title: "AI Review Complete",
                description: "A performance summary has been added to the relevant partner's To-Do list."
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
                    <CardTitle>Budget Overrun Report</CardTitle>
                    <CardDescription>Engagements where logged hours have exceeded the budgeted/standard hours by more than 5 hours.</CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Engagement</TableHead>
                                <TableHead className="text-right">Budgeted Hours</TableHead>
                                <TableHead className="text-right">Logged Hours</TableHead>
                                <TableHead className="text-right">Overrun</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length > 0 ? (
                                reportData.map(item => (
                                    <TableRow key={item.engagement.id}>
                                        <TableCell>
                                            <Link href={`/workflow/${item.engagement.id}`} className="font-medium hover:underline text-primary">
                                                {item.engagement.remarks}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">{item.budgetedHours.toFixed(1)}</TableCell>
                                        <TableCell className="text-right font-mono">{item.totalHours.toFixed(1)}</TableCell>
                                        <TableCell className="text-right font-mono text-destructive">
                                            <Badge variant="destructive">+{item.overrun.toFixed(1)} hrs</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="outline" onClick={() => handleRunAIReview(item.engagement)} disabled={processingId === item.engagement.id}>
                                                {processingId === item.engagement.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Bot className="mr-2 h-4 w-4" />}
                                                Review with AI
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">No significant budget overruns found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                     </Table>
                </CardContent>
            </Card>
        </div>
    )
}

