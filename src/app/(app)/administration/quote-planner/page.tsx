

"use client";

import * as React from "react";
import { collection, query, onSnapshot, getDocs, doc, setDoc, addDoc, where, orderBy, writeBatch, updateDoc } from "firebase/firestore";
import { db, logActivity } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Employee, Client, EngagementType, Quote, Engagement, Task } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, PlusCircle, Check, ChevronsUpDown, Calculator, FileSignature, Save, Briefcase, FileClock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn, capitalizeWords } from "@/lib/utils";
import { EditClientSheet } from "@/components/dashboard/edit-client-sheet";
import { BudgetHoursDialog } from "@/components/administration/budget-hours-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";


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
    const [allQuotes, setAllQuotes] = React.useState<Quote[]>([]);

    // Form State
    const [selectedClientId, setSelectedClientId] = React.useState<string>("");
    const [selectedEngagementTypeId, setSelectedEngagementTypeId] = React.useState<string>("");
    const [selectedEmployeeIds, setSelectedEmployeeIds] = React.useState<string[]>([]);
    const [budgetedResources, setBudgetedResources] = React.useState<{ employeeId: string; hours: number }[]>([]);
    const [selectedPartnerId, setSelectedPartnerId] = React.useState<string>("");
    const [calculation, setCalculation] = React.useState<CalculationResult | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [quotedAmount, setQuotedAmount] = React.useState<number>(0);

    // Client Search and Creation State
    const [isClientPopoverOpen, setIsClientPopoverOpen] = React.useState(false);
    const [clientSearchQuery, setClientSearchQuery] = React.useState("");
    const [isClientSheetOpen, setIsClientSheetOpen] = React.useState(false);
    const [newClientData, setNewClientData] = React.useState<Partial<Client> | null>(null);
    const [isBudgetHoursDialogOpen, setIsBudgetHoursDialogOpen] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState<string | null>(null);


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
            onSnapshot(query(collection(db, "quotes"), orderBy("createdAt", "desc")), snap => setAllQuotes(snap.docs.map(d => d.data() as Quote)))
        ];
        setLoading(false);
        return () => unsubs.forEach(unsub => unsub());
    }, []);
    
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
        setNewClientData({ name: clientSearchQuery });
        setIsClientPopoverOpen(false);
        setIsClientSheetOpen(true);
    };

    const handleSaveNewClient = async (clientData: Partial<Client>) => {
        try {
            const newDocRef = doc(collection(db, "clients"));
            const newClient = { ...clientData, id: newDocRef.id, lastUpdated: new Date().toISOString() };
            if (newClient.name) {
                newClient.name = capitalizeWords(newClient.name);
            }
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
        if (budgetedResources.length === 0) {
            toast({ title: "Missing Information", description: "Please set budgeted hours for at least one employee.", variant: "destructive" });
            return;
        }

        let totalCost = 0;
        let totalChargeOut = 0;

        budgetedResources.forEach(resource => {
            const employee = allEmployees.find(e => e.id === resource.employeeId);
            if (!employee) return;
            const department = allDepartments.find(d => d.name === employee.role[0]);
            const weeklyHours = department?.standardWeeklyHours || 40;
            const costPerHour = (employee.monthlySalary || 0) * 12 / 52 / weeklyHours;
            
            totalCost += costPerHour * resource.hours;
            totalChargeOut += (employee.chargeOutRate || 0) * resource.hours;
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
            const totalPlannedHours = budgetedResources.reduce((sum, r) => sum + r.hours, 0);

            const newQuote: Quote = {
                id: quoteRef.id,
                clientId: selectedClientId,
                engagementTypeId: selectedEngagementTypeId,
                partnerId: selectedPartnerId,
                budgetedResources: budgetedResources,
                totalPlannedHours: totalPlannedHours,
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
            setBudgetedResources([]);
            setSelectedPartnerId("");
            setCalculation(null);
            setQuotedAmount(0);

        } catch (error) {
            toast({ title: "Save Failed", description: "Could not save the quote.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
     const handleCreateEngagementFromQuote = async (quote: Quote) => {
        if (!currentUser) {
            toast({ title: "Authentication Error", description: "Could not identify current user.", variant: "destructive" });
            return;
        }
        setIsProcessing(quote.id);
        
        try {
            const batch = writeBatch(db);
            const engagementType = allEngagementTypes.find(et => et.id === quote.engagementTypeId);
            if (!engagementType) throw new Error("Could not find the engagement type for this quote.");

            const engagementDocRef = doc(collection(db, 'engagements'));
            const newEngagement: Engagement = {
                id: engagementDocRef.id,
                clientId: quote.clientId,
                type: quote.engagementTypeId,
                remarks: `Engagement from Quote #${quote.id.substring(0, 5)}`,
                assignedTo: quote.budgetedResources.map(r => r.employeeId),
                reportedTo: quote.partnerId,
                status: 'Pending',
                dueDate: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(), // Default 30 days
                budgetedHours: quote.totalPlannedHours,
                fees: quote.quotedAmount,
                quoteId: quote.id
            };
            batch.set(engagementDocRef, newEngagement);

            (engagementType.subTaskTitles || []).forEach((title, index) => {
                const taskDocRef = doc(collection(db, 'tasks'));
                const newTask: Task = {
                    id: taskDocRef.id,
                    engagementId: engagementDocRef.id,
                    title,
                    status: 'Pending',
                    order: index + 1,
                    assignedTo: newEngagement.assignedTo[0] || '', // Assign to first member
                };
                batch.set(taskDocRef, newTask);
            });
            
            const quoteRef = doc(db, 'quotes', quote.id);
            batch.update(quoteRef, { status: 'Archived', engagementId: engagementDocRef.id });

            await batch.commit();

            toast({
                title: "Engagement Created!",
                description: "The quote has been successfully converted into a new engagement.",
            });

            router.push(`/workflow/${engagementDocRef.id}`);

        } catch (error) {
            console.error("Error creating engagement from quote:", error);
            toast({ title: "Creation Failed", description: "Could not create the engagement from this quote.", variant: "destructive" });
        } finally {
            setIsProcessing(null);
        }
    };

    const filteredClients = React.useMemo(() => {
        if (!clientSearchQuery) return allClients;
        return allClients.filter(c => c.name?.toLowerCase().includes(clientSearchQuery.toLowerCase()));
    }, [allClients, clientSearchQuery]);

    const showCreateClientOption = clientSearchQuery && !filteredClients.some(c => c.name?.toLowerCase() === clientSearchQuery.toLowerCase());

    const confirmedQuotes = allQuotes.filter(q => q.status === 'Confirmed');
    const draftQuotes = allQuotes.filter(q => q.status === 'Draft');

    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    const teamToBudget = allEmployees.filter(e => selectedEmployeeIds.includes(e.id));
    
    const renderQuotesTable = (quotes: Quote[]) => {
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Engagement Type</TableHead>
                        <TableHead>Quoted Amount</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {quotes.length > 0 ? quotes.map(quote => {
                        const client = allClients.find(c => c.id === quote.clientId);
                        const engagementType = allEngagementTypes.find(et => et.id === quote.engagementTypeId);
                        return (
                            <TableRow key={quote.id}>
                                <TableCell>{client?.name || 'N/A'}</TableCell>
                                <TableCell>{engagementType?.name || 'N/A'}</TableCell>
                                <TableCell>₹{quote.quotedAmount.toLocaleString()}</TableCell>
                                <TableCell>{format(new Date(quote.createdAt), "dd MMM yyyy")}</TableCell>
                                <TableCell className="text-right">
                                    {quote.status === 'Confirmed' && (
                                        <Button size="sm" onClick={() => handleCreateEngagementFromQuote(quote)} disabled={!!isProcessing}>
                                            {isProcessing === quote.id ? <Loader2 className="mr-2 animate-spin"/> : <Briefcase className="mr-2"/>}
                                            Create Engagement
                                        </Button>
                                    )}
                                    {quote.status === 'Draft' && (
                                        <Button size="sm" variant="secondary">View / Edit</Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        )
                    }) : (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-24">No quotes in this category.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        )
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
                                                    value={client.name || ''}
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
                                <Label>Budgeted Hours</Label>
                                <Button variant="outline" className="w-full justify-start" onClick={() => setIsBudgetHoursDialogOpen(true)} disabled={selectedEmployeeIds.length === 0}>
                                    Set Budgeted Hours ({budgetedResources.reduce((s, r) => s + r.hours, 0)} total)
                                </Button>
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

                <Card>
                    <CardHeader>
                        <CardTitle>Existing Quotes</CardTitle>
                        <CardDescription>View and manage all saved quotes.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="confirmed">
                            <TabsList>
                                <TabsTrigger value="confirmed"><Check className="mr-2"/>Confirmed Quotes</TabsTrigger>
                                <TabsTrigger value="drafts"><FileClock className="mr-2"/>Draft Quotes</TabsTrigger>
                            </TabsList>
                            <TabsContent value="confirmed">
                                {renderQuotesTable(confirmedQuotes)}
                            </TabsContent>
                            <TabsContent value="drafts">
                                {renderQuotesTable(draftQuotes)}
                            </TabsContent>
                        </Tabs>
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
            <BudgetHoursDialog
                isOpen={isBudgetHoursDialogOpen}
                onClose={() => setIsBudgetHoursDialogOpen(false)}
                team={teamToBudget}
                initialBudgets={budgetedResources}
                onSave={setBudgetedResources}
            />
        </>
    );
}
