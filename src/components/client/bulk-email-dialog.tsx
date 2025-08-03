
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Client, Employee } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { sendEmail } from "@/ai/flows/send-email-flow";
import { Badge } from "../ui/badge";

interface BulkEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClients: Client[];
  currentUser: Employee | null;
}

export function BulkEmailDialog({ isOpen, onClose, selectedClients, currentUser }: BulkEmailDialogProps) {
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const { toast } = useToast();

  const signature = React.useMemo(() => {
    if (!currentUser) return "";
    return `\n\nWarm regards,\n${currentUser.name}\n${currentUser.designation || ""}`;
  }, [currentUser]);

  const handleSendEmail = async () => {
    if (!subject || !body) {
      toast({
        title: "Validation Error",
        description: "Subject and body cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
        const clientEmails = selectedClients.map(c => c["Mail ID"]).filter((email): email is string => !!email && email !== "unassigned");

      if (clientEmails.length === 0) {
        throw new Error("No valid client emails to send to.");
      }

      await sendEmail({
        recipientEmails: clientEmails,
        subject,
        body: `${body}${signature}`,
      });

      toast({
        title: "Emails Sent",
        description: `Your message has been sent to ${clientEmails.length} client(s).`,
      });
      onClose();
      setSubject("");
      setBody("");

    } catch (error) {
      console.error("Error sending bulk email:", error);
      toast({
        title: "Sending Failed",
        description: "Could not send the email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Compose Bulk Email</DialogTitle>
          <DialogDescription>
            This email will be sent to {selectedClients.length} selected client(s).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="recipients">Recipients</Label>
             <div className="flex flex-wrap gap-1 p-2 border rounded-md min-h-[40px]">
                {selectedClients.map(c => <Badge key={c.id} variant="secondary">{c.Name}</Badge>)}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="body">Body</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
            />
          </div>
          <div className="grid gap-2">
             <Label>Signature</Label>
             <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground whitespace-pre-wrap">
                {signature}
             </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSendEmail} disabled={isSending}>
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
