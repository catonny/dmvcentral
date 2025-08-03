
"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Client, Engagement, EngagementStatus, EngagementType } from "@/lib/data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { doc, writeBatch, setDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

const engagementStatuses: EngagementStatus[] = [
    "Pending",
    "Awaiting Documents",
    "In Process",
    "Partner Review",
    "Completed",
    "Cancelled"
];

const statusColorClasses: Record<EngagementStatus, string> = {
  "Pending": "bg-gray-200 text-gray-800",
  "Awaiting Documents": "bg-yellow-200 text-yellow-800",
  "In Process": "bg-blue-200 text-blue-800",
  "Partner Review": "bg-purple-200 text-purple-800",
  "Completed": "bg-green-200 text-green-800",
  "Cancelled": "bg-red-200 text-red-800",
};


interface EditableStatusProps {
  engagement: Engagement;
  client?: Client;
  engagementType?: EngagementType;
  onStatusChange: (engagementId: string, newStatus: EngagementStatus, submitToBilling?: boolean) => void;
}

export function EditableStatus({ engagement, client, engagementType, onStatusChange }: EditableStatusProps) {
  const [currentStatus, setCurrentStatus] = React.useState<EngagementStatus>(engagement.status);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [nextStatus, setNextStatus] = React.useState<EngagementStatus | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    setCurrentStatus(engagement.status);
  }, [engagement.status]);

  const handleValueChange = (newStatus: EngagementStatus) => {
    if (newStatus === "Completed") {
      setNextStatus(newStatus);
      setIsConfirmOpen(true);
    } else {
      onStatusChange(engagement.id, newStatus, false);
    }
  };

  const handleConfirmBilling = async (submit: boolean) => {
    if (nextStatus) {
      onStatusChange(engagement.id, nextStatus, submit);
      if (submit && client) {
        try {
            const batch = writeBatch(db);
            const engagementRef = doc(db, "engagements", engagement.id);
            batch.update(engagementRef, {
                billStatus: "To Bill",
                billSubmissionDate: new Date().toISOString()
            });

            const pendingInvoiceRef = doc(collection(db, "pendingInvoices"));
            batch.set(pendingInvoiceRef, {
                id: pendingInvoiceRef.id,
                engagementId: engagement.id,
                clientId: engagement.clientId,
                assignedTo: engagement.assignedTo,
                reportedTo: engagement.reportedTo,
                partnerId: client.partnerId
            });

            await batch.commit();

        } catch (error) {
            console.error("Error creating pending invoice:", error);
            toast({ title: "Error", description: "Could not create pending invoice record.", variant: "destructive" });
        }
      }
    }
    setIsConfirmOpen(false);
    setNextStatus(null);
  }

  const colorClass = statusColorClasses[currentStatus] || "bg-gray-200 text-gray-800";

  return (
    <>
      <Select value={currentStatus} onValueChange={handleValueChange}>
        <SelectTrigger className={`w-[180px] text-xs font-semibold border-none focus:ring-0 ${colorClass}`}>
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          {engagementStatuses.map((status) => (
            <SelectItem key={status} value={status}>
              <span className="flex items-center">
                  <span className={`h-2 w-2 rounded-full mr-2 ${statusColorClasses[status]}`}></span>
                  {status}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit for Billing?</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to submit the engagement "{engagement.remarks}" for client "{client?.Name}" for billing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleConfirmBilling(false)}>No</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmBilling(true)}>Yes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
