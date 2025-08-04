
"use client";

import * as React from "react";
import type { Client, Engagement, Employee, EngagementType } from "@/lib/data";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Button } from "../ui/button";
import Link from "next/link";
import { addDoc, collection, doc, updateDoc, writeBatch, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { EditEngagementSheet } from "../reports/edit-engagement-sheet";

interface AllEngagementsViewProps {
    engagements: Engagement[];
    clientMap: Map<string, Client>;
    employees: Employee[];
    currentUserEmployee: Employee | null;
}

export function AllEngagementsView({ engagements, clientMap, employees, currentUserEmployee }: AllEngagementsViewProps) {
    const [searchTerm, setSearchTerm] = React.useState("");
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [selectedEngagement, setSelectedEngagement] = React.useState<Engagement | null>(null);
    const { toast } = useToast();
    
    const employeeMap = React.useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

    const filteredEngagements = React.useMemo(() => {
        if (!searchTerm) return engagements;
        const lowercasedFilter = searchTerm.toLowerCase();
        return engagements.filter(eng => {
            const client = clientMap.get(eng.clientId);
            const assignedEmployees = eng.assignedTo.map(id => employeeMap.get(id)?.name || "").join(" ");
            return (
                eng.remarks.toLowerCase().includes(lowercasedFilter) ||
                (client && client.Name.toLowerCase().includes(lowercasedFilter)) ||
                assignedEmployees.toLowerCase().includes(lowercasedFilter)
            );
        });
    }, [engagements, searchTerm, clientMap, employeeMap]);
    
     const handleOpenEditSheet = (engagement: Engagement) => {
        setSelectedEngagement(engagement);
        setIsSheetOpen(true);
    };

    const handleCloseEditSheet = () => {
        setIsSheetOpen(false);
        setSelectedEngagement(null);
    };
    
    const handleJoinEngagement = async (engagement: Engagement) => {
        if (!currentUserEmployee) {
            toast({ title: "Error", description: "Could not identify current user.", variant: "destructive" });
            return;
        }

        if (engagement.assignedTo.includes(currentUserEmployee.id)) {
            toast({ title: "Already a member", description: "You are already assigned to this engagement." });
            return;
        }
        
        try {
            const engagementRef = doc(db, "engagements", engagement.id);
            const newAssignedTo = [...engagement.assignedTo, currentUserEmployee.id];
            
            const batch = writeBatch(db);
            batch.update(engagementRef, { assignedTo: newAssignedTo });

            // Also assign all pending tasks to the new user.
            const tasksSnapshot = await getDocs(collection(db, 'tasks'));
            tasksSnapshot.docs
                .map(d => d.data() as any)
                .filter(t => t.engagementId === engagement.id && t.status === 'Pending')
                .forEach(task => {
                    const taskRef = doc(db, "tasks", task.id);
                    batch.update(taskRef, { assignedTo: currentUserEmployee.id });
                });
            
            await batch.commit();

            toast({ title: "Success!", description: `You have joined the engagement: "${engagement.remarks}"` });
        } catch (error) {
             console.error("Error joining engagement:", error);
            toast({ title: "Error", description: "Failed to join the engagement.", variant: "destructive" });
        }
    }
    
    const handleSaveEngagement = async (engagementData: Partial<Engagement>) => {
        if (!selectedEngagement?.id) return;
        try {
            const engagementRef = doc(db, "engagements", selectedEngagement.id);
            await updateDoc(engagementRef, engagementData);
            toast({ title: "Success", description: "Engagement updated successfully." });
            handleCloseEditSheet();
        } catch (error) {
            console.error("Error saving engagement:", error);
            toast({ title: "Error", description: "Failed to save engagement data.", variant: "destructive" });
        }
    };

    const typedSelectedEngagement = selectedEngagement ? {
        ...selectedEngagement,
        clientName: clientMap.get(selectedEngagement.clientId)?.Name || "N/A",
        engagementTypeName: "N/A", // This isn't needed for the edit sheet's purposes here
    } : null;

    return (
        <div className="h-full flex flex-col">
            <div className="mb-4">
                <Input
                    placeholder="Search by engagement, client, or employee..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                />
            </div>
            <ScrollArea className="flex-grow">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-4 pb-4">
                    {filteredEngagements.map(engagement => {
                        const client = clientMap.get(engagement.clientId);
                        const isAssigned = currentUserEmployee && engagement.assignedTo.includes(currentUserEmployee.id);
                        const isReporter = currentUserEmployee && engagement.reportedTo === currentUserEmployee.id;
                        const isPartner = currentUserEmployee && client?.partnerId === currentUserEmployee.id;
                        const hasEditAccess = isAssigned || isReporter || isPartner;

                        return (
                            <Card key={engagement.id} className="flex flex-col">
                                <CardHeader>
                                    <CardTitle className="text-base">{engagement.remarks}</CardTitle>
                                    <CardDescription>
                                        Client:{" "}
                                        <Button variant="link" asChild className="p-0 h-auto">
                                             <Link href={`/workspace/${engagement.clientId}`}>
                                                {client?.Name || "..."}
                                            </Link>
                                        </Button>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <h4 className="text-sm font-semibold mb-2">Team:</h4>
                                    <div className="flex items-center -space-x-2">
                                        <TooltipProvider>
                                            {engagement.assignedTo.map(id => {
                                                const employee = employeeMap.get(id);
                                                if (!employee) return null;
                                                return (
                                                    <Tooltip key={id}>
                                                        <TooltipTrigger asChild>
                                                            <Avatar className="h-8 w-8 border-2 border-background">
                                                                <AvatarImage src={employee.avatar} alt={employee.name} />
                                                                <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{employee.name}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )
                                            })}
                                            {engagement.assignedTo.length === 0 && <div className="text-sm text-muted-foreground pl-2">Unassigned</div>}
                                        </TooltipProvider>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex justify-end gap-2">
                                     <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                 <div className="flex-grow">
                                                    <Button variant="ghost" size="sm" onClick={() => handleOpenEditSheet(engagement)} disabled={!hasEditAccess}>
                                                        Details
                                                    </Button>
                                                </div>
                                            </TooltipTrigger>
                                            {!hasEditAccess && <TooltipContent><p>You must be the Partner, Reporter, or an Assignee to edit.</p></TooltipContent>}
                                        </Tooltip>
                                     </TooltipProvider>
                                    <Button size="sm" onClick={() => handleJoinEngagement(engagement)} disabled={isAssigned || !hasEditAccess}>
                                        {isAssigned ? "Joined" : "Join"}
                                    </Button>
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
                 {filteredEngagements.length === 0 && (
                    <div className="text-center text-muted-foreground py-16">
                        No engagements match your search.
                    </div>
                )}
            </ScrollArea>
             <EditEngagementSheet
                isOpen={isSheetOpen}
                onClose={handleCloseEditSheet}
                onSave={handleSaveEngagement}
                engagement={typedSelectedEngagement}
                allEmployees={employees}
            />
        </div>
    );
}
