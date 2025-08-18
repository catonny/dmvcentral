
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Search, Send, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Client, Engagement, EngagementType, EngagementStatus } from "@/lib/data";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { engagementStatuses } from "@/components/reports/engagement-statuses";
import { sendBulkPersonalizedEmail } from "@/ai/flows/send-bulk-email-flow";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface FilterState {
    engagementTypeId: string;
    status: EngagementStatus | "All";
    financialYear: string;
    recurrence: string;
}

export default function BulkEmailPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [allEngagementTypes, setAllEngagementTypes] = React.useState<EngagementType[]>([]);
    const [allEngagements, setAllEngagements] = React.useState<Engagement[]>([]);
    const [allClients, setAllClients] = React.useState<Client[]>([]);
    
    const [filters, setFilters] = React.useState<Partial<FilterState>>({});
    const [isLoading, setIsLoading] = React.useState(false);
    const [isListDialogOpen, setIsListDialogOpen] = React.useState(false);
    const [isComposeDialogOpen, setIsComposeDialogOpen] = React.useState(false);

    const [potentialRecipients, setPotentialRecipients] = React.useState<Client[]>([]);
    const [selectedRecipients, setSelectedRecipients] = React.useState<Client[]>([]);
    
    const [subject, setSubject] = React.useState("");
    const [body, setBody] = React.useState("");
    const [isSending, setIsSending] = React.useState(false);
    
    React.useEffect(() => {
        const unsubTypes = onSnapshot(collection(db, "engagementTypes"), (snap) => setAllEngagementTypes(snap.docs.map(d => d.data() as EngagementType)));
        const unsubEngagements = onSnapshot(collection(db, "engagements"), (snap) => setAllEngagements(snap.docs.map(d => d.data() as Engagement)));
        const unsubClients = onSnapshot(collection(db, "clients"), (snap) => setAllClients(snap.docs.map(d => ({id: d.id, ...d.data()} as Client))));
        
        return () => { unsubTypes(); unsubEngagements(); unsubClients(); };
    }, []);

    const handleGenerateList = async () => {
        if (!filters.engagementTypeId) {
            toast({ title: "Filter required", description: "Please select an engagement type.", variant: "destructive" });
            return;
        }
        setIsLoading(true);
        let filteredEngagements = allEngagements.filter(e => e.type === filters.engagementTypeId);

        if (filters.status && filters.status !== "All") {
            filteredEngagements = filteredEngagements.filter(e => e.status === filters.status);
        }
        if (filters.financialYear) {
            filteredEngagements = filteredEngagements.filter(e => e.financialYear === filters.financialYear);
        }
        
        // This is a placeholder for more advanced recurrence filtering
        if (filters.recurrence) {
            // This would need a more robust check, perhaps on the engagementType
        }
        
        const clientIds = new Set(filteredEngagements.map(e => e.clientId));
        const clients = allClients.filter(c => clientIds.has(c.id));
        
        setPotentialRecipients(clients);
        setSelectedRecipients(clients);
        setIsListDialogOpen(true);
        setIsLoading(false);
    }
    
    const handleProceedToCompose = () => {
        if (selectedRecipients.length === 0) {
            toast({ title: "No clients selected", description: "Please select at least one client to email.", variant: "destructive" });
            return;
        }
        setIsListDialogOpen(false);
        setIsComposeDialogOpen(true);
    };

    const handleSendEmail = async () => {
        if (!subject || !body) {
            toast({ title: "Email content required", description: "Please provide a subject and body.", variant: "destructive" });
            return;
        }
        setIsSending(true);
        try {
            const clientData = selectedRecipients.map(client => ({
                id: client.id,
                name: client.name,
                email: client.mailId,
            }));

            await sendBulkPersonalizedEmail({
                clients: clientData,
                subjectTemplate: subject,
                bodyTemplate: body,
                engagementTypeId: filters.engagementTypeId,
                status: filters.status,
                financialYear: filters.financialYear
            });

            toast({
                title: "Success!",
                description: `Emails are being sent to ${selectedRecipients.length} clients.`
            });
            setIsComposeDialogOpen(false);
            setSubject("");
            setBody("");
            setSelectedRecipients([]);

        } catch (error) {
             console.error(error);
             toast({ title: "Error", description: "Failed to send emails.", variant: "destructive" });
        } finally {
            setIsSending(false);
        }
    };
    
    const selectedEngagementType = allEngagementTypes.find(et => et.id === filters.engagementTypeId);

    return (
        <div className="space-y-6">
             <Button variant="outline" size="sm" onClick={() => router.push('/administration')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Administration
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>Bulk Email Center</CardTitle>
                    <CardDescription>Send targeted, personalized emails to clients based on engagement criteria.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="p-4 border rounded-lg space-y-4">
                        <h3 className="font-semibold">Client Filters</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="grid gap-2">
                                <Label>Engagement Type</Label>
                                <Select value={filters.engagementTypeId} onValueChange={(v) => setFilters({...filters, engagementTypeId: v})}>
                                    <SelectTrigger><SelectValue placeholder="Select type..."/></SelectTrigger>
                                    <SelectContent>
                                        {allEngagementTypes.map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Engagement Status</Label>
                                <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v as any})}>
                                    <SelectTrigger><SelectValue placeholder="All Statuses"/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="All">All Statuses</SelectItem>
                                        {engagementStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Financial Year (Optional)</Label>
                                <Input value={filters.financialYear} onChange={(e) => setFilters({...filters, financialYear: e.target.value})} placeholder="e.g., 2023-24"/>
                            </div>
                            {selectedEngagementType?.recurrence && (
                                <div className="grid gap-2">
                                    <Label>Frequency</Label>
                                     <Select value={filters.recurrence} onValueChange={(v) => setFilters({...filters, recurrence: v})}>
                                        <SelectTrigger><SelectValue placeholder="Any Frequency"/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Any">Any</SelectItem>
                                            <SelectItem value="Monthly">Monthly</SelectItem>
                                            <SelectItem value="Quarterly">Quarterly</SelectItem>
                                            <SelectItem value="Yearly">Yearly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleGenerateList} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 animate-spin"/> : <Search className="mr-2"/>}
                            Generate Client List
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Client Selection Dialog */}
            <Dialog open={isListDialogOpen} onOpenChange={setIsListDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Select Recipients</DialogTitle>
                        <DialogDescription>
                            Found {potentialRecipients.length} clients matching your criteria. Uncheck any you want to exclude.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-96 border rounded-md p-4">
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="select-all"
                                    checked={selectedRecipients.length === potentialRecipients.length}
                                    onCheckedChange={(checked) => setSelectedRecipients(checked ? potentialRecipients : [])}
                                />
                                <Label htmlFor="select-all" className="font-semibold">Select All</Label>
                            </div>
                            {potentialRecipients.map(client => (
                                <div key={client.id} className="flex items-center space-x-2">
                                    <Checkbox
                                        id={client.id}
                                        checked={selectedRecipients.some(c => c.id === client.id)}
                                        onCheckedChange={(checked) => {
                                            setSelectedRecipients(prev => 
                                                checked ? [...prev, client] : prev.filter(c => c.id !== client.id)
                                            );
                                        }}
                                    />
                                    <Label htmlFor={client.id}>{client.name}</Label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsListDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleProceedToCompose}>
                            Compose Email ({selectedRecipients.length})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            {/* Email Composer Dialog */}
            <Dialog open={isComposeDialogOpen} onOpenChange={setIsComposeDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Compose Bulk Email</DialogTitle>
                        <DialogDescription>
                            Your message will be sent to {selectedRecipients.length} client(s). Use placeholders for personalization.
                        </DialogDescription>
                    </DialogHeader>
                     <div className="space-y-4 py-4">
                        <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md">
                           <b>Available Placeholders:</b> {`{{clientName}}`}, {`{{engagementType}}`}, {`{{dueDate}}`}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="body">Body</Label>
                            <Textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} rows={12}/>
                        </div>
                    </div>
                     <DialogFooter>
                        <Button variant="outline" onClick={() => setIsComposeDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSendEmail} disabled={isSending}>
                            {isSending && <Loader2 className="mr-2 animate-spin" />}
                            <Send className="mr-2"/>
                            Send Emails
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
