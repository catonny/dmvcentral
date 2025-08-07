
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Employee, EngagementType, ActivityLog } from "@/lib/data";
import { ScrollArea } from "../ui/scroll-area";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { Badge } from "../ui/badge";
import { GitCommit, History, MessageSquare, Calendar, CheckSquare, Pencil, User, FilePlus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";


interface EngagementHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  employees: Employee[];
  engagementTypes: EngagementType[];
}

const activityIcons: { [key: string]: React.ElementType } = {
    CREATE_ENGAGEMENT: FilePlus,
    STATUS_CHANGE: GitCommit,
    TASK_COMPLETED: CheckSquare,
    NOTE_ADDED: MessageSquare,
    DUE_DATE_CHANGED: Calendar,
    ASSIGNEE_CHANGED: UserPlus,
    REMARKS_CHANGED: Pencil,
};

const ActivityItem = ({ activity }: { activity: ActivityLog }) => {
    const Icon = activityIcons[activity.type] || History;
    let content = null;

    switch (activity.type) {
        case 'CREATE_ENGAGEMENT':
            content = <><span className="font-semibold">{activity.userName}</span> created the engagement: <span className="font-semibold text-primary">{activity.details.engagementName}</span></>;
            break;
        case 'STATUS_CHANGE':
            content = <><span className="font-semibold">{activity.userName}</span> changed status of <span className="font-semibold text-primary">{activity.details.engagementName}</span> from <Badge variant="outline">{activity.details.from}</Badge> to <Badge variant="outline">{activity.details.to}</Badge></>;
            break;
        case 'TASK_COMPLETED':
            content = <><span className="font-semibold">{activity.userName}</span> completed task: <span className="font-semibold">{activity.details.taskName}</span> for <span className="font-semibold text-primary">{activity.details.engagementName}</span></>;
            break;
        case 'DUE_DATE_CHANGED':
            content = <><span className="font-semibold">{activity.userName}</span> changed the due date for <span className="font-semibold text-primary">{activity.details.engagementName}</span> to {format(parseISO(activity.details.to!), "MMM dd, yyyy")}</>;
            break;
        case 'ASSIGNEE_CHANGED':
             content = <><span className="font-semibold">{activity.userName}</span> re-assigned <span className="font-semibold text-primary">{activity.details.engagementName}</span> from {activity.details.from} to <span className="font-semibold">{activity.details.to}</span></>;
             break;
        case 'REMARKS_CHANGED':
             content = <><span className="font-semibold">{activity.userName}</span> updated the remarks for an engagement.</>;
             break;
        default:
            content = <><span className="font-semibold">{activity.userName}</span> performed an action on <span className="font-semibold text-primary">{activity.details.engagementName}</span></>;
    }

    return (
        <div className="flex items-start gap-4">
            <div className="flex flex-col items-center self-stretch">
                <div className="bg-muted p-2 rounded-full">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="w-px flex-grow bg-border my-2"></div>
            </div>
            <div className="flex-grow pb-8">
                <p className="text-sm">{content}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(parseISO(activity.timestamp), { addSuffix: true })}</p>
            </div>
        </div>
    );
};


export function EngagementHistoryDialog({ isOpen, onClose, clientId, clientName }: EngagementHistoryDialogProps) {
  const [activities, setActivities] = React.useState<ActivityLog[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!isOpen || !clientId) return;

    setLoading(true);
    const q = query(
        collection(db, "activityLog"),
        where("clientId", "==", clientId),
        orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        setActivities(snapshot.docs.map(doc => doc.data() as ActivityLog));
        setLoading(false);
    }, (error) => {
        console.error("Error fetching activity log:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, clientId]);
  
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
            <ScrollArea className="h-full pr-6">
               {loading ? (
                   <div className="flex justify-center items-center h-full">
                       <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                   </div>
               ) : activities.length > 0 ? (
                   activities.map((activity, index) => (
                        <ActivityItem key={activity.id} activity={activity} />
                   ))
               ) : (
                   <div className="text-center text-sm text-muted-foreground pt-10">No history found for this client.</div>
               )}
            </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
