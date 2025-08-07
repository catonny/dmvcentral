

"use client";

import * as React from "react";
import { getDoc, collection, onSnapshot, query, where, writeBatch, updateDoc, addDoc, serverTimestamp, orderBy, getDocs, doc, setDoc } from "firebase/firestore";
import type { Client, Engagement, Employee, EngagementType, Task, TaskStatus, EngagementNote } from "@/lib/data";
import { db } from "@/lib/firebase";
import { notFound, useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckSquare, MessageSquare, Send, Book, FileText, StickyNote } from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";


function EngagementNotes({ engagement, client, allEmployees }: { engagement: Engagement; client: Client, allEmployees: Employee[] }) {
    const { user } = useAuth();
    const [notes, setNotes] = React.useState<EngagementNote[]>([]);
    const [newNote, setNewNote] = React.useState("");
    const [activeTab, setActiveTab] = React.useState<EngagementNote['category']>("Note");
    const [currentUserEmployee, setCurrentUserEmployee] = React.useState<Employee | null>(null);

    React.useEffect(() => {
        if (user) {
            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            getDocs(employeeQuery).then(snapshot => {
                if (!snapshot.empty) {
                    setCurrentUserEmployee({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Employee);
                }
            });
        }
    }, [user]);

    React.useEffect(() => {
        const q = query(
            collection(db, "engagementNotes"), 
            where("engagementId", "==", engagement.id),
            orderBy("createdAt", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNotes(snapshot.docs.map(doc => doc.data() as EngagementNote));
        });
        return () => unsubscribe();
    }, [engagement.id]);

    const handleAddNote = async () => {
        if (!newNote.trim() || !currentUserEmployee) return;

        const mentions = newNote.match(/@(\w+)/g)?.map(m => m.substring(1)) || [];
        const mentionedIds = allEmployees
            .filter(e => mentions.some(m => e.name.toLowerCase().includes(m.toLowerCase())))
            .map(e => e.id);

        const newNoteData: Omit<EngagementNote, 'id'> = {
            engagementId: engagement.id,
            clientId: engagement.clientId,
            text: newNote.trim(),
            category: activeTab,
            createdBy: currentUserEmployee.id,
            createdAt: new Date().toISOString(),
            mentions: mentionedIds
        };
        
        try {
            const docRef = doc(collection(db, "engagementNotes"));
            await setDoc(docRef, {...newNoteData, id: docRef.id});
            setNewNote("");
        } catch (error) {
            console.error("Error adding note:", error);
        }
    };
    
    const filteredNotes = notes.filter(n => n.category === activeTab);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>Engagement Notes</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col gap-4">
                 <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="Note"><StickyNote className="mr-2"/>Notes</TabsTrigger>
                        <TabsTrigger value="Current File"><FileText className="mr-2"/>Current File</TabsTrigger>
                        <TabsTrigger value="Permanent File"><Book className="mr-2"/>Permanent File</TabsTrigger>
                    </TabsList>
                </Tabs>
                <ScrollArea className="flex-grow h-[300px] pr-4">
                     <div className="space-y-4">
                        {filteredNotes.length > 0 ? filteredNotes.map(note => (
                             <div key={note.id} className="flex items-start gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={allEmployees.find(e=>e.id === note.createdBy)?.avatar} />
                                    <AvatarFallback>{allEmployees.find(e=>e.id === note.createdBy)?.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="bg-muted p-3 rounded-lg text-sm flex-grow">
                                     <p className="font-bold text-xs mb-1">{allEmployees.find(e=>e.id === note.createdBy)?.name}</p>
                                    <p className="whitespace-pre-wrap">{note.text}</p>
                                    <p className="text-xs opacity-70 mt-2 text-right">{formatDistanceToNow(parseISO(note.createdAt), {addSuffix: true})}</p>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center text-muted-foreground pt-10">No notes in this category yet.</div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
             <CardFooter className="pt-4 border-t">
                 <div className="flex w-full items-center gap-2">
                    <Textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder={`Add to ${activeTab}...`}
                        className="min-h-0"
                    />
                    <Button onClick={handleAddNote} size="icon" disabled={!newNote.trim()}>
                        <Send className="h-4 w-4" />
                        <span className="sr-only">Add Note</span>
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}

export default function EngagementWorkflowPage() {
  const params = useParams();
  const engagementId = params.engagementId as string;
  const [engagement, setEngagement] = React.useState<Engagement | null>(null);
  const [client, setClient] = React.useState<Client | null>(null);
  const [engagementType, setEngagementType] = React.useState<EngagementType | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();
  const router = useRouter();
  
  const [remarks, setRemarks] = React.useState("");
  const debouncedRemarks = useDebounce(remarks, 500);

  React.useEffect(() => {
    if (engagement) {
      setRemarks(engagement.remarks || "");
    }
  }, [engagement]);
  
   React.useEffect(() => {
    if (engagement && debouncedRemarks !== engagement.remarks) {
      const updateRemarks = async () => {
        const engagementRef = doc(db, "engagements", engagementId);
        try {
          await updateDoc(engagementRef, { remarks: debouncedRemarks });
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
        }
      };
      updateRemarks();
    }
  }, [debouncedRemarks, engagement, engagementId, toast]);

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
    const taskRef = doc(db, "tasks", taskId);
    try {
        await updateDoc(taskRef, { status: newStatus });
    } catch (error) {
         console.error(`Error updating task status:`, error);
        toast({ title: "Error", description: `Failed to update task status.`, variant: "destructive" });
    }
  };


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
            <Link href="/workspace">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to My Engagements
            </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
            <CardTitle className="font-headline text-2xl">{engagementType?.name || engagement.type}</CardTitle>
            <CardDescription>
                Client: {client.Name} | Due: {format(parseISO(engagement.dueDate), "dd MMM, yyyy")}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-2">
                <Label htmlFor="remarks">Engagement Remarks</Label>
                <Textarea 
                    id="remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Add specific details about this engagement..."
                />
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
  );
}
