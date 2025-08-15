
"use client";

import * as React from "react";
import { collection, query, onSnapshot, getDocs, doc, setDoc, addDoc } from "firebase/firestore";
import { db, logActivity } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Employee, Client, EngagementType, Quote } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, PlusCircle, Check, ChevronsUpDown, Calculator, FileSignature, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface CalculationResult {
  estimatedCost: number;
  costPlus50: number;
  quotedRevenue: number;
}

export default function QuotePlannerPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = React.useState(true);
    const [currentUser, setCurrentUser] = React.useState<Employee | null>(null);

    // Master Data
    const [allClients, setAllClients] = React.useState<Client[]>([]);
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
    const [allEngagementTypes, setAllEngagementTypes] = React.useState<EngagementType[]>([]);
    const [allDepartments, setAllDepartments] = React.useState<any[]>([]);

    // Form State
    const [selectedClientId, setSelectedClientId] = React.useState<string>("");
    const [selectedEngagementTypeId, setSelectedEngagementTypeId] = React.useState<string>("");
    const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<string[]>([]);
    const [plannedDays, setPlannedDays] = React.useState<number>(1);
    const [calculation, setCalculation] = React.useState<CalculationResult | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [quotedAmount, setQuotedAmount] = React.useState<number>(0);


    React.useEffect(() => {
        if (user) {
            const q = query(collection(db, "employees"), where("email", "==", user.email));
            getDocs(q).then(snap => {
                if (!snap.empty) setCurrentUser(snap.docs[0].data() as Employee);
            });
        }
    }, [user]);

    React.useEffect(() => {
        const unsubs = [
            onSnapshot(collection(db, "clients"), snap => setAllClients(snap.docs.map(d => ({id: d.id, ...d.data()}) as Client))),
            onSnapshot(collection(db, "employees"), snap => setAllEmployees(snap.docs.map(d => ({id: d.id, ...d.data()}) as Employee))),
            onSnapshot(collection(db, "engagementTypes"), snap => setAllEngagementTypes(snap.docs.map(d => ({id: d.id, ...d.data()}) as EngagementType))),
            onSnapshot(collection(db, "departments"), snap => setAllDepartments(snap.docs.map(d => d.data()))),
        ];
        setLoading(false);
        return () => unsubs.forEach(unsub => unsub());
    }, []);

    const handleCalculateQuote = () => {
        if (selectedEmployeeIds.length === 0 || !plannedDays || plannedDays <= 0) {
            toast({ title: "Missing Information", description: "Please select employees and enter valid planned days.", variant: "destructive" });
            return;
        }

        const plannedHours = plannedDays * 8;
        let totalCost = 0;
        let totalChargeOut = 0;

        selectedEmployeeIds.forEach(id => {
            const employee = allEmployees.find(e => e.id === id);
            if (!employee) return;
            const department = allDepartments.find(d => d.name === employee.role[0]);
            const weeklyHours = department?.standardWeeklyHours || 40;
            const costPerHour = (employee.monthlySalary || 0) * 12 / 52 / weeklyHours;
            
            totalCost += costPerHour * (plannedHours / selectedEmployeeIds.length); // Distribute hours evenly
            totalChargeOut += (employee.chargeOutRate || 0) * (plannedHours / selectedEmployeeIds.length);
        });

        const newCalculation = {
            estimatedCost: totalCost,
            costPlus50: totalCost * 1.5,
            quotedRevenue: totalChargeOut,
        };
        setCalculation(newCalculation);
        setQuotedAmount(newCalculation.quotedRevenue);
    };
    
    const handleSaveQuote = async (status: 'Draft' | 'Confirmed') => {
        if (!calculation || !selectedClientId || !selectedEngagementTypeId || !currentUser || !quotedAmount) {
             toast({ title: "Error", description: "Please calculate a quote and select a client/type first.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            const quoteRef = doc(collection(db, "quotes"));
            const newQuote: Quote = {
                id: quoteRef.id,
                clientId: selectedClientId,
                engagementTypeId: selectedEngagementTypeId,
                plannedDays,
                plannedHours: plannedDays * 8,
                assignedEmployeeIds: selectedEmployeeIds,
                estimatedCost: calculation.estimatedCost,
                quotedAmount: quotedAmount,
                costPlus50: calculation.costPlus50,
                status,
                createdAt: new Date().toISOString(),
                createdBy: currentUser.id,
            };
            await setDoc(quoteRef, newQuote);
            
            await logActivity({
                clientId: newQuote.clientId,
                type: 'CREATE_ENGAGEMENT', // Re-using for quote creation
                user: currentUser,
                details: { engagementName: `Quote for ${allEngagementTypes.find(et => et.id === newQuote.engagementTypeId)?.name}` },
            });
            
            toast({ title: "Success!", description: `Quote has been saved as ${status}.`});
            // Reset form
            setSelectedClientId("");
            setSelectedEngagementTypeId("");
            setSelectedEmployeeIds([]);
            setPlannedDays(1);
            setCalculation(null);
            setQuotedAmount(0);

        } catch (error) {
            toast({ title: "Save Failed", description: "Could not save the quote.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <Button variant="outline" size="sm" onClick={() => router.push('/administration')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Administration
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileSignature/>Quote Planner</CardTitle>
                    <CardDescription>Plan and estimate costs and revenue for new engagements.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     {/* Left Column: Inputs */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Client</Label>
                             <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                                <SelectTrigger><SelectValue placeholder="Select client..."/></SelectTrigger>
                                <SelectContent>{allClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label>Engagement Type</Label>
                             <Select value={selectedEngagementTypeId} onValueChange={setSelectedEngagementTypeId}>
                                <SelectTrigger><SelectValue placeholder="Select type..."/></SelectTrigger>
                                <SelectContent>{allEngagementTypes.map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                             <Label>Assign Team</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start">{selectedEmployeeIds.length > 0 ? `${selectedEmployeeIds.length} selected` : "Select team..."}</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                    <Command>
                                        <CommandInput placeholder="Search..." />
                                        <CommandList>
                                            <CommandEmpty>No results found.</CommandEmpty>
                                            <CommandGroup>
                                                {allEmployees.map(emp => (
                                                    <CommandItem key={emp.id} onSelect={() => setSelectedEmployeeIds(prev => prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id])}>
                                                        <Check className={cn("mr-2 h-4 w-4", selectedEmployeeIds.includes(emp.id) ? "opacity-100" : "opacity-0")} />
                                                        {emp.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>Planned Days</Label>
                            <Input type="number" value={plannedDays} onChange={(e) => setPlannedDays(Number(e.target.value))} placeholder="e.g., 5"/>
                        </div>
                        <Button onClick={handleCalculateQuote}><Calculator className="mr-2"/>Calculate Quote</Button>
                    </div>

                    {/* Right Column: Calculations */}
                    <div className="space-y-4 p-4 rounded-lg bg-muted">
                        <h3 className="font-semibold text-lg">Quote Estimate</h3>
                        {calculation ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-sm text-muted-foreground">Estimated Cost:</span>
                                    <span className="text-lg font-mono">₹{calculation.estimatedCost.toFixed(2)}</span>
                                </div>
                                 <div className="flex justify-between items-baseline">
                                    <span className="text-sm text-muted-foreground">Cost + 50%:</span>
                                    <span className="text-lg font-mono">₹{calculation.costPlus50.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-baseline">
                                    <span className="text-sm text-muted-foreground">Suggested Quote (Rate Card):</span>
                                    <span className="text-lg font-mono">₹{calculation.quotedRevenue.toFixed(2)}</span>
                                </div>
                                 <div className="space-y-2 border-t pt-4">
                                     <Label htmlFor="quotedAmount">Final Quoted Amount</Label>
                                     <Input id="quotedAmount" type="number" value={quotedAmount} onChange={(e) => setQuotedAmount(Number(e.target.value))} />
                                 </div>
                                 <div className="flex justify-end gap-2 pt-4">
                                    <Button variant="secondary" onClick={() => handleSaveQuote('Draft')} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="mr-2 animate-spin"/> : <Save className="mr-2" />}
                                        Save as Draft
                                    </Button>
                                    <Button onClick={() => handleSaveQuote('Confirmed')} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="mr-2 animate-spin"/> : <Check className="mr-2" />}
                                        Confirm Quote
                                    </Button>
                                 </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                <p>Calculation results will appear here.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
