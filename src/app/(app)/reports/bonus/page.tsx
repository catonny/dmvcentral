
"use client";

import * as React from "react";
import { collection, onSnapshot, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Bonus, BonusRule, Employee } from "@/lib/data";
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

function BonusRulesManager({ hasAccess }: { hasAccess: boolean }) {
    const { toast } = useToast();
    const [rules, setRules] = React.useState<Partial<BonusRule>>({
        savingsThresholdPercentage: 20,
        bonusSharePercentage: 100,
    });
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (!hasAccess) {
            setIsLoading(false);
            return;
        }
        const ruleRef = doc(db, "bonusRules", "default");
        const unsub = onSnapshot(ruleRef, (doc) => {
            if (doc.exists()) {
                setRules(doc.data() as BonusRule);
            }
            setIsLoading(false);
        });
        return () => unsub();
    }, [hasAccess]);

    const handleSaveRules = async () => {
        setIsSaving(true);
        try {
            const ruleRef = doc(db, "bonusRules", "default");
            await setDoc(ruleRef, { ...rules, id: 'default' }, { merge: true });
            toast({ title: "Success", description: "Bonus rules have been updated." });
        } catch (error) {
            toast({ title: "Error", description: "Could not save bonus rules.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    if (!hasAccess) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings />Bonus Calculation Rules</CardTitle>
                <CardDescription>Define how employee bonuses are calculated based on engagement profitability.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="space-y-2">
                    <Label htmlFor="savingsThreshold">Savings Threshold (%)</Label>
                    <Input
                        id="savingsThreshold"
                        type="number"
                        value={rules.savingsThresholdPercentage || ''}
                        onChange={(e) => setRules(prev => ({ ...prev, savingsThresholdPercentage: Number(e.target.value) }))}
                        placeholder="e.g., 20"
                    />
                    <p className="text-xs text-muted-foreground">A bonus is considered only if cost savings exceed this percentage.</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="bonusShare">Bonus Share of Excess Savings (%)</Label>
                     <Input
                        id="bonusShare"
                        type="number"
                        value={rules.bonusSharePercentage || ''}
                        onChange={(e) => setRules(prev => ({ ...prev, bonusSharePercentage: Number(e.target.value) }))}
                        placeholder="e.g., 50"
                    />
                    <p className="text-xs text-muted-foreground">The percentage of the *excess* savings (above the threshold) to be distributed as a bonus.</p>
                </div>
                 <Button onClick={handleSaveRules} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Rules
                </Button>
            </CardContent>
        </Card>
    )
}

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
            
            <BonusRulesManager hasAccess={hasAccess} />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Trophy/>Employee Bonus Report</CardTitle>
                    <CardDescription>
                        Summary and details of bonuses earned by employees from profitable engagements.
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
                                            <TableHead className="text-right">Total Bonus (₹)</TableHead>
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
