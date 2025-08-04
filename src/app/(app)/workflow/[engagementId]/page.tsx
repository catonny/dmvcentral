
"use client";

import * as React from "react";
import { doc, getDoc, collection, onSnapshot, query, where, writeBatch, updateDoc } from "firebase/firestore";
import type { Client, Engagement, Employee, EngagementType, Task, TaskStatus } from "@/lib/data";
import { db } from "@/lib/firebase";
import { notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckSquare, MessageSquare } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

function EngagementNotes({ engagement, onNotesChange }: { engagement: Engagement, onNotesChange: (notes: string) => void }) {
    const [notes, setNotes] = React.useState(engagement.notes || "");
    const debouncedNotes = useDebounce(notes, 500);

    React.useEffect(() => {
        setNotes(engagement.notes || "");
    }, [engagement.notes]);

    React.useEffect(() => {
        if (debouncedNotes !== (engagement.notes || "")) {
            onNotesChange(debouncedNotes);
        }
    }, [debouncedNotes, engagement.notes, onNotesChange]);

    return (
        <Textarea
            placeholder="Add detailed notes for this engagement..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-2 min-h-[150px]"
        />
    );
}

export default function EngagementWorkflowPage({ params }: { params: { engagementId: string } }) {
  const engagementId = params.engagementId;
  const [engagement, setEngagement] = React.useState<Engagement | null>(null);
  const [client, setClient] = React.useState<Client | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();
  const router = useRouter();

  React.useEffect(() => {
    if (!engagementId) return;

    setLoading(true);

    const engagementUnsub = onSnapshot(doc(db, "engagements", engagementId), (doc) => {
      if (doc.exists()) {
        setEngagement({ id: doc.id, ...doc.data() } as Engagement);
      } else {
        setEngagement(null);
        notFound();
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
      engagementUnsub();
      tasksUnsub();
    };
  }, [engagementId]);

  React.useEffect(() => {
      if (engagement?.clientId) {
          const clientUnsub = onSnapshot(doc(db, "clients", engagement.clientId), (doc) => {
              if (doc.exists()) {
                  setClient({ id: doc.id, ...doc.data() } as Client);
              }
              setLoading(false);
          });
          return () => clientUnsub();
      } else if (engagement === null) {
          setLoading(false); // Handle case where engagement is not found
      }
  }, [engagement]);

  const handleTaskStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const taskRef = doc(db, "tasks", taskId);
    try {
        await updateDoc(taskRef, { status: newStatus });
        // The onSnapshot listener will update the state automatically
    } catch (error) {
         console.error(`Error updating task status:`, error);
        toast({ title: "Error", description: `Failed to update task status.`, variant: "destructive" });
    }
  };

  const handleNotesChange = async (notes: string) => {
    try {
        await updateDoc(doc(db, "engagements", engagementId), { notes });
        toast({ title: "Note Saved", description: "Your notes have been automatically saved." });
    } catch (error) {
        console.error("Error saving notes:", error);
        toast({ title: "Error", description: "Failed to save notes.", variant: "destructive" });
    }
  }

  if (loading) {
    return <div className="flex h-full w-full items-center justify-center">Loading Engagement Workflow...</div>;
  }

  if (!engagement || !client) {
    notFound();
    return null;
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="outline" size="sm">
            <Link href="/workflow">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to My Engagements
            </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
            <CardTitle className="font-headline text-2xl">{engagement.remarks}</CardTitle>
            <CardDescription>
                Client: {client.Name} | Due: {format(parseISO(engagement.dueDate), "dd MMM, yyyy")}
            </CardDescription>
        </CardHeader>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
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
          <Card>
             <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Engagement Notes
                </CardTitle>
                <CardDescription>Add and view notes for this engagement.</CardDescription>
            </CardHeader>
            <CardContent>
                <EngagementNotes engagement={engagement} onNotesChange={handleNotesChange} />
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
