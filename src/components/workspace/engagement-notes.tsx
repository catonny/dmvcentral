
"use client";

import * as React from "react";
import { collection, onSnapshot, query, where, doc, getDocs, setDoc, orderBy } from "firebase/firestore";
import type { Client, Engagement, Employee, EngagementNote } from "@/lib/data";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Send, Book, FileText, StickyNote } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export function EngagementNotes({ engagement, client, allEmployees }: { engagement: Engagement; client: Client, allEmployees: Employee[] }) {
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
                <CardTitle>Engagement Notebook</CardTitle>
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
