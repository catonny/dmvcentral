
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, ArrowLeft, Bot, User, Check, Users } from "lucide-react";
import { collection, onSnapshot, query, writeBatch, doc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Client, Employee, EngagementType, ClientCategory, Engagement, Task } from "@/lib/data";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { scheduleEngagements } from "@/ai/flows/engagement-scheduler-flow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

type Step = "define" | "assign" | "confirm";

interface AssignmentPlan {
    clientId: string;
    clientName: string;
    assignedToId: string;
    assignedToName: string;
    reportedToId: string;
    reportedToName: string;
}

export default function EngagementSchedulerPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [step, setStep] = React.useState<Step>("define");
    
    // Data stores
    const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);
    const [clientCategories, setClientCategories] = React.useState<ClientCategory[]>([]);
    const [allClients, setAllClients] = React.useState<Client[]>([]);
    const [employees, setEmployees] = React.useState<Employee[]>([]);

    // Step 1 state
    const [selectedEngagementTypeId, setSelectedEngagementTypeId] = React.useState<string>("");
    const [selectedClientCategories, setSelectedClientCategories] = React.useState<string[]>([]);
    const [dueDate, setDueDate] = React.useState<Date | undefined>(addDays(new Date(), 30));

    // Step 2 state
    const [assignmentPrompt, setAssignmentPrompt] = React.useState("");
    const [fetchedClients, setFetchedClients] = React.useState<Client[]>([]);
    const [isGeneratingPlan, setIsGeneratingPlan] = React.useState(false);

    // Step 3 state
    const [assignmentPlan, setAssignmentPlan] = React.useState<AssignmentPlan[]>([]);
    const [isCreatingEngagements, setIsCreatingEngagements] = React.useState(false);


    React.useEffect(() => {
        const unsubEngagementTypes = onSnapshot(collection(db, "engagementTypes"), snap => setEngagementTypes(snap.docs.map(d => d.data() as EngagementType)));
        const unsubClientCategories = onSnapshot(collection(db, "clientCategories"), snap => setClientCategories(snap.docs.map(d => d.data() as ClientCategory)));
        const unsubClients = onSnapshot(collection(db, "clients"), snap => setAllClients(snap.docs.map(d => d.data() as Client)));
        const unsubEmployees = onSnapshot(collection(db, "employees"), snap => setEmployees(snap.docs.map(d => d.data() as Employee)));
        return () => { unsubEngagementTypes(); unsubClientCategories(); unsubClients(); unsubEmployees(); };
    }, []);

    const handleFetchClients = () => {
        if (!selectedEngagementTypeId || selectedClientCategories.length === 0 || !dueDate) {
            toast({ title: "Missing Information", description: "Please select an engagement type, due date, and at least one client category.", variant: "destructive"});
            return;
        }
        const clients = allClients.filter(c => selectedClientCategories.includes(c.Category!));
        setFetchedClients(clients);
        setStep("assign");
    };

    const handleGeneratePlan = async () => {
        if (!assignmentPrompt) {
            toast({ title: "Missing Prompt", description: "Please describe how to assign the engagements.", variant: "destructive"});
            return;
        }
        setIsGeneratingPlan(true);
        try {
            // const result = await scheduleEngagements({
            //     clientIds: fetchedClients.map(c => c.id),
            //     assignmentPrompt: assignmentPrompt,
            // });

            // if (!result || !result.plan || result.plan.length === 0) {
            //      toast({ title: "AI Error", description: "The AI could not generate a valid assignment plan. Please try a different prompt.", variant: "destructive" });
            //      return;
            // }
            
            // setAssignmentPlan(result.plan);
            // setStep("confirm");
             toast({ title: "AI Feature Disabled", description: "The AI Engagement Scheduler is temporarily disabled.", variant: "destructive" });


        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "An unexpected error occurred while generating the plan.", variant: "destructive"});
        } finally {
            setIsGeneratingPlan(false);
        }
    };

    const handleCreateEngagements = async () => {
        setIsCreatingEngagements(true);
        try {
            const batch = writeBatch(db);
            const engagementType = engagementTypes.find(et => et.id === selectedEngagementTypeId);
            if (!engagementType) throw new Error("Engagement type not found");

            assignmentPlan.forEach(plan => {
                const engagementDocRef = doc(collection(db, "engagements"));
                const newEngagement: Omit<Engagement, 'id'> = {
                    clientId: plan.clientId,
                    type: selectedEngagementTypeId,
                    remarks: engagementType.name,
                    dueDate: dueDate!.toISOString(),
                    status: "Pending",
                    assignedTo: [plan.assignedToId],
                    reportedTo: plan.reportedToId,
                };
                batch.set(engagementDocRef, {...newEngagement, id: engagementDocRef.id});
                
                // Create tasks
                (engagementType.subTaskTitles || []).forEach((title, index) => {
                    const taskDocRef = doc(collection(db, 'tasks'));
                    const newTask: Task = {
                        id: taskDocRef.id,
                        engagementId: engagementDocRef.id,
                        title,
                        status: 'Pending',
                        order: index + 1,
                        assignedTo: plan.assignedToId,
                    };
                    batch.set(taskDocRef, newTask);
                });
            });

            await batch.commit();

            toast({ title: "Success!", description: `${assignmentPlan.length} engagements have been created and assigned.`});
            handleReset();

        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to create engagements.", variant: "destructive"});
        } finally {
            setIsCreatingEngagements(false);
        }
    }
    
    const handleReset = () => {
        setStep("define");
        setSelectedEngagementTypeId("");
        setSelectedClientCategories([]);
        setDueDate(addDays(new Date(), 30));
        setAssignmentPrompt("");
        setFetchedClients([]);
        setAssignmentPlan([]);
    }

    const renderStepContent = () => {
        switch (step) {
            case "define":
                return (
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>1. Select Engagement Type</Label>
                            <Select value={selectedEngagementTypeId} onValueChange={setSelectedEngagementTypeId}>
                                <SelectTrigger><SelectValue placeholder="Select an engagement type..." /></SelectTrigger>
                                <SelectContent>
                                    {engagementTypes.map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>2. Select Due Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                                    {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus /></PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label>3. Select Client Categories</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {clientCategories.map(cat => (
                                    <Button key={cat.id} variant={selectedClientCategories.includes(cat.name) ? "secondary" : "outline"} onClick={() => {
                                        setSelectedClientCategories(prev => prev.includes(cat.name) ? prev.filter(c => c !== cat.name) : [...prev, cat.name])
                                    }}>
                                        <Check className={cn("mr-2 h-4 w-4", selectedClientCategories.includes(cat.name) ? "opacity-100" : "opacity-0")} />
                                        {cat.name}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={handleFetchClients}>Fetch Clients <ArrowRight className="ml-2 h-4 w-4" /></Button>
                        </div>
                    </CardContent>
                );
            case "assign":
                 return (
                    <CardContent className="space-y-6">
                        <CardHeader className="p-0">
                            <CardTitle className="flex items-center gap-2 text-primary"><Users className="h-6 w-6"/> Step 2: Assign Engagements</CardTitle>
                            <CardDescription>You are creating <Badge>{fetchedClients.length}</Badge> engagements for the <Badge>{engagementTypes.find(et=>et.id===selectedEngagementTypeId)?.name}</Badge> type. Describe how you want to assign them.</CardDescription>
                        </CardHeader>
                        
                        <div className="space-y-2">
                            <Label htmlFor="assignment-prompt">Assignment Instructions</Label>
                            <Textarea
                                id="assignment-prompt"
                                value={assignmentPrompt}
                                onChange={e => setAssignmentPrompt(e.target.value)}
                                placeholder="e.g., Assign all to Dojo Davis. Or, distribute equally between Tonny Varghese and all employees in the Articles department."
                                rows={4}
                            />
                        </div>

                         <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep("define")}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                            <Button onClick={handleGeneratePlan} disabled={isGeneratingPlan || true}>
                                {isGeneratingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Bot className="mr-2 h-4 w-4" />}
                                Generate Assignment Plan (Disabled)
                            </Button>
                        </div>
                    </CardContent>
                 );
            case "confirm":
                return (
                    <CardContent className="space-y-6">
                         <CardHeader className="p-0">
                            <CardTitle className="flex items-center gap-2 text-primary"><Check className="h-6 w-6"/> Step 3: Confirm Plan</CardTitle>
                            <CardDescription>The AI has generated the following assignment plan. Review and confirm to create the engagements.</CardDescription>
                        </CardHeader>

                        <ScrollArea className="h-72 w-full rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Client</TableHead>
                                        <TableHead>Assigned To</TableHead>
                                        <TableHead>Reports To</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {assignmentPlan.map(plan => (
                                        <TableRow key={plan.clientId}>
                                            <TableCell>{plan.clientName}</TableCell>
                                            <TableCell>{plan.assignedToName}</TableCell>
                                            <TableCell>{plan.reportedToName}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                        
                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setStep("assign")}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                            <Button onClick={handleCreateEngagements} disabled={isCreatingEngagements}>
                                {isCreatingEngagements ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Confirm and Create Engagements
                            </Button>
                        </div>
                    </CardContent>
                )
        }
    }


    return (
        <div>
            <Button variant="outline" size="sm" onClick={() => router.push('/administration')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Administration
            </Button>
            <Card className="max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle>AI Engagement Scheduler</CardTitle>
                    <CardDescription>Create and assign new engagements for multiple clients in a few steps.</CardDescription>
                </CardHeader>
                {renderStepContent()}
            </Card>
        </div>
    );
}
