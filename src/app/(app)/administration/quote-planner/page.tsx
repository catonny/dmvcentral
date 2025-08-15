
"use client";

import * as React from "react";
import { collection, query, onSnapshot, getDocs, doc, setDoc, addDoc, where } from "firebase/firestore";
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
import { cn, capitalizeWords } from "@/lib/utils";
import { EditClientSheet } from "@/components/dashboard/edit-client-sheet";

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
    const [selectedPartnerId, setSelectedPartnerId] = React.useState<string>("");
    const [plannedHours, setPlannedHours] = React.useState<number>(0);
    const [calculation, setCalculation] = React.useState<CalculationResult | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [quotedAmount, setQuotedAmount] = React.useState<number>(0);

    // Client Search and Creation State
    const [isClientPopoverOpen, setIsClientPopoverOpen] = React.useState(false);
    const [clientSearchQuery, setClientSearchQuery] = React.useState("");
    const [isClientSheetOpen, setIsClientSheetOpen] = React.useState(false);
    const [newClientData, setNewClientData] = React.useState<Partial<Client> | null>(null);


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

    React.useEffect(() => {
        if (selectedEngagementTypeId) {
            const engagementType = allEngagementTypes.find(et => et.id === selectedEngagementTypeId);
            if (engagementType?.standardHours) {
                setPlannedHours(engagementType.standardHours);
            } else {
                setPlannedHours(0);
            }
        }
    }, [selectedEngagementTypeId, allEngagementTypes]);
    
    React.useEffect(() => {
        if (selectedClientId) {
            const client = allClients.find(c => c.id === selectedClientId);
            if (client?.partnerId) {
                setSelectedPartnerId(client.partnerId);
            }
        }
    }, [selectedClientId, allClients]);
    
    const partners = React.useMemo(() => {
        const partnerDept = allDepartments.find(d => d.name.toLowerCase() === 'partner');
        if (!partnerDept) return [];
        return allEmployees.filter(s => Array.isArray(s.role) && s.role.includes(partnerDept.name));
    }, [allEmployees, allDepartments]);

    const handleClientSelect = (clientId: string) => {
        setSelectedClientId(clientId);
        setIsClientPopoverOpen(false);
    };

    const handleCreateNewClient = () => {
        setNewClientData({ name: capitalizeWords(clientSearchQuery) });
        setIsClientPopoverOpen(false);
        setIsClientSheetOpen(true);
    };

    const handleSaveNewClient = async (clientData: Partial<Client>) => {
        try {
            const newDocRef = doc(collection(db, "clients"));
            const newClient = { ...clientData, id: newDocRef.id, lastUpdated: new Date().toISOString() };
            await setDoc(newDocRef, newClient);
            toast({ title: "Success", description: "New client added successfully." });
            setSelectedClientId(newDocRef.id);
            setIsClientSheetOpen(false);
            setNewClientData(null);
            setClientSearchQuery("");
        } catch (error) {
            console.error("Error saving client:", error);
            toast({ title: "Error", description: "Failed to save client data.", variant: "destructive" });
        }
    };

    const handleCalculateQuote = () => {
        if (selectedEmployeeIds.length === 0 || !plannedHours || plannedHours <= 0) {
            toast({ title: "Missing Information", description: "Please select employees and enter valid planned hours.", variant: "destructive" });
            return;
        }

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
        if (!calculation || !selectedClientId || !selectedEngagementTypeId || !currentUser || !quotedAmount || !selectedPartnerId) {
             toast({ title: "Error", description: "Please calculate a quote and select a client, partner, and type first.", variant: "destructive" });
            return;
        }
        setIsSaving(true);
        try {
            const quoteRef = doc(collection(db, "quotes"));
            const newQuote: Quote = {
                id: quoteRef.id,
                clientId: selectedClientId,
                engagementTypeId: selectedEngagementTypeId,
                partnerId: selectedPartnerId,
                plannedDays: plannedHours / 8, // Assuming 8-hour day
                plannedHours: plannedHours,
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
            setSelectedPartnerId("");
            setPlannedHours(0);
            setCalculation(null);
            setQuotedAmount(0);

        } catch (error) {
            toast({ title: "Save Failed", description: "Could not save the quote.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const filteredClients = React.useMemo(() => {
        if (!clientSearchQuery) return allClients;
        return allClients.filter(c => c.name && c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()));
    }, [allClients, clientSearchQuery]);

    const showCreateClientOption = clientSearchQuery && !filteredClients.some(c => c.name && c.name.toLowerCase() === clientSearchQuery.toLowerCase());


    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <>
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
                                <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                                    <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isClientPopoverOpen}
                                        className="w-full justify-between"
                                    >
                                        {selectedClientId
                                        ? allClients.find((client) => client.id === selectedClientId)?.name
                                        : "Select or create client..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command shouldFilter={false}>
                                        <CommandInput 
                                            placeholder="Search client..." 
                                            value={clientSearchQuery}
                                            onValueChange={setClientSearchQuery}
                                        />
                                        <CommandList>
                                            <CommandEmpty>
                                                <div className="p-4 text-sm text-center">
                                                    No client found. <br/>
                                                    <Button variant="link" onClick={handleCreateNewClient} className="h-auto p-1 mt-1">
                                                        <PlusCircle className="mr-2" />
                                                        Add New Client
                                                    </Button>
                                                </div>
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {filteredClients.map((client) => (
                                                    <CommandItem
                                                    key={client.id}
                                                    value={client.name}
                                                    onSelect={() => handleClientSelect(client.id)}
                                                    >
                                                    <Check
                                                        className={cn(
                                                        "mr-2 h-4 w-4",
                                                        selectedClientId === client.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {client.name}
                                                    </CommandItem>
                                                ))}
                                                {showCreateClientOption && (
                                                    <CommandItem onSelect={handleCreateNewClient} className="cursor-pointer">
                                                        <PlusCircle className="mr-2" />
                                                        Create "{clientSearchQuery}"
                                                    </CommandItem>
                                                )}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label>Partner</Label>
                                <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId} disabled={!selectedClientId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select partner..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                    </SelectContent>
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
                                <Label>Planned Hours</Label>
                                <Input type="number" value={plannedHours || ""} onChange={(e) => setPlannedHours(Number(e.target.value))} placeholder="e.g., 40"/>
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
            <EditClientSheet
                client={newClientData}
                isOpen={isClientSheetOpen}
                onClose={() => setIsClientSheetOpen(false)}
                onSave={handleSaveNewClient}
                onDelete={() => {}} // Not used for creation
                allClients={allClients}
            />
        </>
    );
}
