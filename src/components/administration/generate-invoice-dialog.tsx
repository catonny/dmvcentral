
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Engagement, Client, EngagementType, Firm } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface GenerateInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (engagementId: string, fee: number) => Promise<void>;
  entry: {
    engagement: Engagement;
    client: Client;
    engagementType: EngagementType;
  } | null;
  firms: Firm[];
}

export function GenerateInvoiceDialog({
  isOpen,
  onClose,
  onSave,
  entry,
  firms,
}: GenerateInvoiceDialogProps) {
  const [fee, setFee] = React.useState<number | string>("");
  const [selectedFirmId, setSelectedFirmId] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (entry) {
      setFee(entry.engagement.fees || "");
      setSelectedFirmId(entry.client.firmId || (firms.length > 0 ? firms[0].id : ""));
    }
  }, [entry, firms]);

  const handleSave = async () => {
    const numericFee = Number(fee);
    if (!entry || !selectedFirmId || isNaN(numericFee) || numericFee <= 0) {
      toast({
        title: "Validation Error",
        description: "Please select a firm and enter a valid positive fee.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    await onSave(entry.engagement.id, numericFee);
    setIsSaving(false);
  };

  const handleDialogClose = () => {
    setFee("");
    setSelectedFirmId("");
    onClose();
  };
  
  if (!entry) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
          <DialogDescription>
            Confirm details for the invoice for{" "}
            <span className="font-semibold">{entry.client.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="firm">Issuing Firm</Label>
            <Select value={selectedFirmId} onValueChange={setSelectedFirmId}>
                <SelectTrigger id="firm">
                    <SelectValue placeholder="Select a firm..." />
                </SelectTrigger>
                <SelectContent>
                    {firms.map(firm => (
                        <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="service">Service Line Item</Label>
            <Input id="service" value={entry.engagementType.name} readOnly />
          </div>
           <div className="grid gap-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" value={entry.engagement.remarks} readOnly />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fees">Professional Fees (INR)</Label>
            <Input
              id="fees"
              type="number"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="Enter professional fees"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleDialogClose}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save &amp; Mark as Billed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
