
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Employee, EngagementType } from "@/lib/data";
import { ScrollArea } from "../ui/scroll-area";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { Badge } from "../ui/badge";
import { GitCommit, History, MessageSquare, Calendar, CheckSquare, Pencil, User, FilePlus } from "lucide-react";
import { cn } from "@/lib/utils";


interface EngagementHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  employees: Employee[];
  engagementTypes: EngagementType[];
}

// SIMULATED DATA - In a real app, this would come from a Firestore query
const simulatedActivityLog = [
    { id: "1", type: "CREATE_ENGAGEMENT", user: "Tonny Varghese", engagement: "ITR Filing for FY 2023-24", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "2", type: "STATUS_CHANGE", user: "Tonny Varghese", from: "Pending", to: "In Process", engagement: "ITR Filing for FY 2023-24", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
    { id: "3", type: "TASK_COMPLETED", user: "Tonny Varghese", task: "Collect Documents", engagement: "ITR Filing for FY 2023-24", timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString() },
    { id: "4", type: "NOTE_ADDED", user: "Tonny Varghese", noteSnippet: "Client confirmed all documents are uploaded...", engagement: "ITR Filing for FY 2023-24", timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString() },
    { id: "5", type: "DUE_DATE_CHANGED", user: "Tonny Varghese", from: "2024-07-25T00:00:00.000Z", to: "2024-07-31T00:00:00.000Z", engagement: "ITR Filing for FY 2023-24", timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
    { id: "6", type: "CREATE_ENGAGEMENT", user: "Tonny Varghese", engagement: "GST Return for June 2024", timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
];

const activityIcons: { [key: string]: React.ElementType } = {
    CREATE_ENGAGEMENT: FilePlus,
    STATUS_CHANGE: GitCommit,
    TASK_COMPLETED: CheckSquare,
    NOTE_ADDED: MessageSquare,
    DUE_DATE_CHANGED: Calendar,
};

const ActivityItem = ({ activity }: { activity: (typeof simulatedActivityLog)[0] }) => {
    const Icon = activityIcons[activity.type] || History;
    let content = null;

    switch (activity.type) {
        case 'CREATE_ENGAGEMENT':
            content = <><span className="font-semibold">{activity.user}</span> created the engagement: <span className="font-semibold text-primary">{activity.engagement}</span></>;
            break;
        case 'STATUS_CHANGE':
            content = <><span className="font-semibold">{activity.user}</span> changed status of <span className="font-semibold text-primary">{activity.engagement}</span> from <Badge variant="outline">{activity.from}</Badge> to <Badge variant="outline">{activity.to}</Badge></>;
            break;
        case 'TASK_COMPLETED':
            content = <><span className="font-semibold">{activity.user}</span> completed task: <span className="font-semibold">{activity.task}</span> for <span className="font-semibold text-primary">{activity.engagement}</span></>;
            break;
        case 'NOTE_ADDED':
            content = <><span className="font-semibold">{activity.user}</span> added a note to <span className="font-semibold text-primary">{activity.engagement}</span>: <em className="text-muted-foreground">"{activity.noteSnippet}"</em></>;
            break;
        case 'DUE_DATE_CHANGED':
            content = <><span className="font-semibold">{activity.user}</span> changed the due date for <span className="font-semibold text-primary">{activity.engagement}</span> to {format(parseISO(activity.to!), "MMM dd, yyyy")}</>;
            break;
        default:
            content = <><span className="font-semibold">{activity.user}</span> performed an action on <span className="font-semibold text-primary">{activity.engagement}</span></>;
    }

    return (
        <div className="flex items-start gap-4">
            <div className="flex flex-col items-center">
                <div className="bg-muted p-2 rounded-full">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="w-px h-full bg-border my-2"></div>
            </div>
            <div className="flex-grow pb-8">
                <p className="text-sm">{content}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(parseISO(activity.timestamp), { addSuffix: true })}</p>
            </div>
        </div>
    );
};


export function EngagementHistoryDialog({ isOpen, onClose, clientId, clientName, employees, engagementTypes }: EngagementHistoryDialogProps) {
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Activity History for {clientName}</DialogTitle>
          <DialogDescription>
            A chronological log of all actions and updates related to this client's engagements.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden relative">
            <ScrollArea className="h-full pr-4">
               {simulatedActivityLog.map((activity, index) => (
                    <ActivityItem key={activity.id} activity={activity} />
               ))}
               <div className="text-center text-sm text-muted-foreground py-4">End of history</div>
            </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
