
"use client";

import * as React from "react";
import { getDoc, collection, onSnapshot, query, where, writeBatch, updateDoc, addDoc, serverTimestamp, orderBy, getDocs, doc, setDoc } from "firebase/firestore";
import type { Client, Engagement, Employee, EngagementType, Task, TaskStatus, EngagementStatus } from "@/lib/data";
import { db, logActivity, notify } from "@/lib/firebase";
import { notFound, useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckSquare, MessageSquare, Send, Book, FileText, StickyNote, Edit, Check, Timer } from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { Label } from "@/components/ui/label";
import { EditEngagementSheet } from "@/components/reports/edit-engagement-sheet";
import { EngagementNotes } from "@/components/workspace/engagement-notes";
import { LogTimeDialog } from "@/components/workspace/log-time-dialog";
import { EditableStatus } from "@/components/workspace/editable-status";
import { EditableAssignees } from "@/components/workspace/editable-assignees";


export default function EngagementWorkflowPage() {
  const params = useParams();
  const { user } = useAuth();
  const engagementId = params.engagementId as string;
  const [engagement, setEngagement] = React.useState<Engagement | null>(null);
  const [client, setClient] = React.useState<Client | null>(null);
  const [engagementType, setEngagementType] = React.useState<EngagementType | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
  const [currentUserEmployee, setCurrentUserEmployee] = React.useState<Employee | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();
  
  const [remarks, setRemarks] = React.useState("");
  const [isEditingRemarks, setIsEditingRemarks] = React.useState(false);
  const [isLogTimeOpen, setIsLogTimeOpen] = React.useState(false);

  React.useEffect(() => {
    if (user) {
        getDocs(query(collection(db, "employees"), where("email", "==", user.email)))
            .then(snap => {
                if (!snap.empty) setCurrentUserEmployee(snap.docs[0].data() as Employee);
            });
    }
  }, [user]);

  const handleUpdateRemarks = async () => {
    if (!currentUserEmployee || !engagement || remarks === engagement.remarks) {
        setIsEditingRemarks(false);
        return;
    }
    const engagementRef = doc(db, "engagements", engagementId);
    try {
        await updateDoc(engagementRef, { remarks });
        await logActivity({
            engagement: { ...engagement, remarks: remarks },
            type: 'REMARKS_CHANGED',
            user: currentUserEmployee,
            details: {}
        });
        toast({
            title: "Saved",
            description: "Engagement remarks have been updated.",
        });
    } catch (error) {
        console.error("Error updating remarks:", error);
        toast({
            title: "Error",
            description: "Failed to save remarks.",
            variant: "destructive",
        });
        setRemarks(engagement.remarks || ""); // Revert on failure
    } finally {
        setIsEditingRemarks(false);
    }
  };


  React.useEffect(() => {
    if (engagement) {
      setRemarks(engagement.remarks || "");
    }
  }, [engagement]);
  
  React.useEffect(() => {
    if (!engagementId) {
        setLoading(true);
        return;
    }

    setLoading(true);

    const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
        setAllEmployees(snapshot.docs.map(doc => doc.data() as Employee));
    });

    const engagementUnsub = onSnapshot(doc(db, "engagements", engagementId), async (docSnap) => {
      if (docSnap.exists()) {
        const engData = { id: docSnap.id, ...docSnap.data() } as Engagement;
        setEngagement(engData);

        const typeDoc = await getDoc(doc(db, "engagementTypes", engData.type));
        if (typeDoc.exists()) {
            setEngagementType(typeDoc.data() as EngagementType);
        } else {
            setEngagementType(null);
        }

        const clientUnsub = onSnapshot(doc(db, "clients", engData.clientId), (clientDoc) => {
          if (clientDoc.exists()) {
            setClient({ id: clientDoc.id, ...clientDoc.data() } as Client);
          } else {
            setClient(null);
          }
          setLoading(false);
        });
        return () => clientUnsub();
      } else {
        setEngagement(null);
        setClient(null);
        setLoading(false);
      }
    }, (error) => {
      console.error("Error fetching engagement:", error);
      setLoading(false);
    });
    
    const tasksQuery = query(collection(db, "tasks"), where("engagementId", "==", engagementId));
    const tasksUnsub = onSnapshot(tasksQuery, (snapshot) => {
        const tasksData = snapshot.docs.map(doc => doc.data() as Task).sort((a,b) => a.order - b.order);
        setTasks(tasksData);
    }, (error) => {
         console.error("Error fetching tasks:", error);
    });

    return () => {
      unsubEmployees();
      engagementUnsub();
      tasksUnsub();
    };
  }, [engagementId]);

  const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    if (!currentUserEmployee || !engagement) return;
    const taskRef = doc(db, "tasks", taskId);
    try {
        await updateDoc(taskRef, { status: newStatus });
        if (newStatus === 'Completed') {
            await logActivity({
                engagement: engagement,
                type: 'TASK_COMPLETED',
                user: currentUserEmployee,
                details: { taskName: tasks.find(t => t.id === taskId)?.title || 'Unknown Task' }
            });
        }
    } catch (error) {
         console.error(`Error updating task status:`, error);
        toast({ title: "Error", description: `Failed to update task status.`, variant: "destructive" });
    }
  };

  const handleSaveEngagement = async (engagementData: Partial<Engagement>) => {
    if (!engagement?.id || !currentUserEmployee) return;
    try {
        const engagementRef = doc(db, "engagements", engagement.id);
        
        if (engagementData.dueDate && engagementData.dueDate !== engagement.dueDate) {
             await logActivity({
                engagement: { ...engagement, ...engagementData },
                type: 'DUE_DATE_CHANGED',
                user: currentUserEmployee,
                details: { from: engagement.dueDate, to: engagementData.dueDate }
            });
        }
        
        await updateDoc(engagementRef, engagementData);
        toast({ title: "Success", description: "Engagement updated successfully." });
        setIsSheetOpen(false);
    } catch (error) {
        console.error("Error saving engagement:", error);
        toast({ title: "Error", description: "Failed to save engagement data.", variant: "destructive" });
    }
  };

  const handleStatusChange = async (engagementId: string, newStatus: EngagementStatus, submitToBilling?: boolean) => {
    if (!currentUserEmployee || !engagement || !client) return;
    
    try {
        const engagementRef = doc(db, "engagements", engagementId);
        const updatePayload: Partial<Engagement> = { status: newStatus };
        if (submitToBilling) {
            updatePayload.billStatus = "To Bill";
            updatePayload.billSubmissionDate = new Date().toISOString();
        }
        await updateDoc(engagementRef, updatePayload);
        
        await logActivity({
            engagement: { ...engagement, status: newStatus },
            type: 'STATUS_CHANGE',
            user: currentUserEmployee,
            details: { from: engagement.status, to: newStatus }
        });
        
        // Notify the partner
        if (client.partnerId) {
            await notify({
                recipients: [client.partnerId],
                type: 'STATUS_CHANGE',
                text: `${currentUserEmployee.name} changed status of "${engagement.remarks}" to ${newStatus}.`,
                relatedEntity: { type: 'engagement', id: engagement.id },
                triggeringUser: currentUserEmployee,
            });
        }

        toast({
            title: "Success",
            description: `Engagement status changed to ${newStatus}. ${submitToBilling ? 'Submitted for billing.' : ''}`,
        });
    } catch (error) {
        console.error(`Error updating status:`, error);
        toast({
            title: "Error",
            description: `Failed to update the status.`,
            variant: "destructive",
        });
    }
  };

    const handleAssigneesChange = (engagementId: string, newAssignees: string[]) => {
        const engagementRef = doc(db, "engagements", engagementId);
        updateDoc(engagementRef, { assignedTo: newAssignees });
        toast({ title: "Success", description: "Assignees updated." });
    };


  if (loading) {
    return <div className="flex h-full w-full items-center justify-center">Loading Engagement Workflow...</div>;
  }

  if (!engagement || !client) {
    notFound();
    return null;
  }

  const typedSelectedEngagement = {
    ...engagement,
    clientName: client.Name,
    engagementTypeName: engagementType?.name || engagement.type,
  };
  
  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="outline" size="sm">
            <Link href="/workspace">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to My Engagements
            </Link>
        </Button>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsLogTimeOpen(true)}>
                <Timer className="mr-2 h-4 w-4" />
                Log Time
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsSheetOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Engagement
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
            <div className="flex justify-between items-start">
                 <div>
                    <CardTitle className="font-headline text-2xl">{engagementType?.name || engagement.type}</CardTitle>
                    <CardDescription>
                        Client: {client.Name} | Due: {format(parseISO(engagement.dueDate), "dd MMM, yyyy")}
                    </CardDescription>
                 </div>
                 <EditableStatus 
                    engagement={engagement}
                    client={client}
                    engagementType={engagementType}
                    onStatusChange={handleStatusChange}
                />
            </div>
        </CardHeader>
        <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="remarks">Engagement Remarks</Label>
                        {!isEditingRemarks ? (
                            <Button variant="ghost" size="sm" onClick={() => setIsEditingRemarks(true)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                            </Button>
                        ) : (
                             <Button variant="ghost" size="sm" onClick={handleUpdateRemarks}>
                                <Check className="mr-2 h-4 w-4" /> Save
                            </Button>
                        )}
                    </div>
                    <Textarea 
                        id="remarks"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Add specific details about this engagement..."
                        disabled={!isEditingRemarks}
                        className={cn(!isEditingRemarks && "bg-muted border-none")}
                    />
                </div>
                 <div className="space-y-2">
                    <Label>Assigned To</Label>
                     <EditableAssignees
                        engagement={engagement}
                        allEmployees={allEmployees}
                        onAssigneesChange={handleAssigneesChange}
                    />
                </div>
             </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-primary" />
                    Task Checklist
                </CardTitle>
                <CardDescription>Check off tasks as you complete them.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {tasks.map(task => (
                        <div key={task.id} className="flex items-center space-x-3 p-3 rounded-md hover:bg-muted/50 transition-colors">
                            <Checkbox
                                id={`task-${task.id}`}
                                checked={task.status === 'Completed'}
                                onCheckedChange={(checked) => {
                                    const newStatus = checked ? 'Completed' : 'Pending';
                                    handleTaskStatusChange(task.id, newStatus);
                                }}
                            />
                            <label
                                htmlFor={`task-${task.id}`}
                                className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", task.status === 'Completed' && 'line-through text-muted-foreground')}
                            >
                                {task.title}
                            </label>
                        </div>
                    ))}
                </div>
            </CardContent>
          </Card>
           <div className="lg:col-span-2 space-y-6">
             <EngagementNotes engagement={engagement} client={client} allEmployees={allEmployees} />
           </div>
      </div>
    </div>
    <EditEngagementSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onSave={handleSaveEngagement}
        engagement={typedSelectedEngagement}
        allEmployees={allEmployees}
    />
    <LogTimeDialog
        isOpen={isLogTimeOpen}
        onClose={() => setIsLogTimeOpen(false)}
        engagement={engagement}
        currentUser={currentUserEmployee}
    />
    </>
  );
}
