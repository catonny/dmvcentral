
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { collection, onSnapshot, query, where, getDocs, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Client, Employee } from "@/lib/data";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateEmail } from "@/ai/flows/generate-email-flow";
import type { GenerateEmailInput } from "@/ai/flows/generate-email-flow";
import { sendEmail } from "@/ai/flows/send-email-flow";
import { Input } from "../ui/input";

const EMAIL_TEMPLATES: GenerateEmailInput['templateName'][] = [
    "New Client Onboarding",
    "Engagement Letter - Audit",
    "Recurring Service Agreement",
    "Fee Revision Approval"
];

export function EmailCenter() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = React.useState<Client[]>([]);
  const [currentUser, setCurrentUser] = React.useState<Employee | null>(null);
  
  const [selectedClientId, setSelectedClientId] = React.useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = React.useState<GenerateEmailInput['templateName'] | "">("");
  
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);
  const [isClientPopoverOpen, setIsClientPopoverOpen] = React.useState(false);
  const [clientSearchQuery, setClientSearchQuery] = React.useState("");
  
  const [generatedSubject, setGeneratedSubject] = React.useState("");
  const [generatedBody, setGeneratedBody] = React.useState("");

  React.useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "employees"), (snapshot) => {
      const employee = snapshot.docs
        .map(d => ({...d.data(), id: d.id } as Employee))
        .find(e => e.email === user.email);
      setCurrentUser(employee || null);
    });
    return () => unsub();
  }, [user]);

  React.useEffect(() => {
    if (!currentUser) return;
    
    let q;
    const isPartner = currentUser.role.includes("Partner");
    if (isPartner && !currentUser.role.includes("Admin")) {
        q = query(collection(db, "clients"), where("partnerId", "==", currentUser.id));
    } else {
        q = query(collection(db, "clients"));
    }

    const unsub = onSnapshot(q, (snapshot) => {
        setClients(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Client)));
    });

    return () => unsub();
  }, [currentUser]);

  const filteredClients = React.useMemo(() => {
    if (!clientSearchQuery) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()));
  }, [clients, clientSearchQuery]);

  const handleGenerateEmail = async () => {
    if (!selectedClientId || !selectedTemplate || !currentUser) {
        toast({ title: "Missing Information", description: "Please select a client and a template.", variant: "destructive"});
        return;
    }

    setIsGenerating(true);
    setGeneratedSubject("");
    setGeneratedBody("");

    try {
        // const result = await generateEmail({
        //     clientId: selectedClientId,
        //     templateName: selectedTemplate,
        //     userId: currentUser.id
        // });
        // setGeneratedSubject(result.subject);
        // setGeneratedBody(result.body);
        toast({ title: "AI Feature Disabled", description: "The AI Email Generator is temporarily disabled.", variant: "destructive" });
    } catch (error) {
        console.error("Error generating email:", error);
        toast({ title: "Generation Failed", description: "The AI could not generate the email.", variant: "destructive"});
    } finally {
        setIsGenerating(false);
    }
  }

  const handleSendEmail = async () => {
      const client = clients.find(c => c.id === selectedClientId);
      if (!client || !client.mailId || client.mailId === "unassigned") {
          toast({ title: "Missing Email", description: "The selected client does not have a valid email address.", variant: "destructive"});
          return;
      }
      if (!generatedSubject || !generatedBody) {
          toast({ title: "Email not ready", description: "Please generate the email content first.", variant: "destructive"});
          return;
      }

      setIsSending(true);
      try {
        await sendEmail({
            recipientEmails: [client.mailId],
            subject: generatedSubject,
            body: generatedBody
        });
        toast({ title: "Email Sent!", description: `The email has been successfully sent to ${client.name}.`});
        // Reset form
        setSelectedClientId("");
        setSelectedTemplate("");
        setGeneratedSubject("");
        setGeneratedBody("");

      } catch (error) {
        console.error("Error sending email:", error);
        toast({ title: "Send Failed", description: "Could not send the email. Please try again.", variant: "destructive"});
      } finally {
        setIsSending(false);
      }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Email Center</CardTitle>
        <CardDescription>
          Generate and send templated, AI-powered emails to a single client.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Controls */}
        <div className="space-y-6">
           <div className="space-y-2">
                <Label>1. Select a Client</Label>
                <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                    <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isClientPopoverOpen}
                        className="w-full justify-between"
                    >
                        {selectedClientId ? clients.find(c => c.id === selectedClientId)?.name : "Select client..."}
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
                            <CommandEmpty>No client found.</CommandEmpty>
                            <CommandGroup>
                            {filteredClients.map((client) => (
                                <CommandItem
                                key={client.id}
                                value={client.name}
                                onSelect={() => {
                                    setSelectedClientId(client.id);
                                    setIsClientPopoverOpen(false);
                                }}
                                >
                                <Check
                                    className={cn("mr-2 h-4 w-4", selectedClientId === client.id ? "opacity-100" : "opacity-0")}
                                />
                                {client.name}
                                </CommandItem>
                            ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                    </PopoverContent>
                </Popover>
           </div>
            <div className="space-y-2">
                <Label>2. Choose an Email Template</Label>
                <Select value={selectedTemplate} onValueChange={(value) => setSelectedTemplate(value as any)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a template..." />
                    </SelectTrigger>
                    <SelectContent>
                        {EMAIL_TEMPLATES.map(template => (
                            <SelectItem key={template} value={template}>{template}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Button onClick={handleGenerateEmail} disabled={isGenerating || !selectedClientId || !selectedTemplate || true}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    3. Generate Email with AI (Disabled)
                </Button>
            </div>
        </div>

        {/* Right Column: Preview & Send */}
        <div className="space-y-4 rounded-lg border p-4 bg-muted/50">
          <h3 className="font-semibold text-lg">Email Preview</h3>
           <div className="space-y-2">
               <Label htmlFor="subject">Subject</Label>
               <Input id="subject" value={generatedSubject} onChange={e => setGeneratedSubject(e.target.value)} placeholder="Email subject will appear here..." />
           </div>
           <div className="space-y-2">
                <Label htmlFor="body">Body</Label>
                <Textarea id="body" value={generatedBody} onChange={e => setGeneratedBody(e.target.value)} placeholder="Email body will appear here..." rows={12} />
           </div>
            <div className="flex justify-end">
                <Button onClick={handleSendEmail} disabled={isSending || !generatedSubject || !generatedBody}>
                    <Send className="mr-2 h-4 w-4" />
                    {isSending ? "Sending..." : "Send Email"}
                </Button>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
