

"use client";

import * as React from "react";
import { collection, onSnapshot, query, where, doc, setDoc, orderBy } from "firebase/firestore";
import type { Client, EngagementNote, Employee } from "@/lib/data";
import { db, logActivity, notify } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Send, Book } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";


export function ClientNotes({ clientId, clientName, allEmployees, currentUserEmployee }: { clientId: string, clientName: string, allEmployees: Employee[], currentUserEmployee: Employee | null }) {
    const [notes, setNotes] = React.useState<EngagementNote[]>([]);
    const [newNote, setNewNote] = React.useState("");
    const { toast } = useToast();

    React.useEffect(() => {
        const q = query(
            collection(db, "engagementNotes"), 
            where("clientId", "==", clientId),
            where("category", "==", "Permanent File"),
            orderBy("createdAt", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNotes(snapshot.docs.map(doc => doc.data() as EngagementNote));
        });
        return () => unsubscribe();
    }, [clientId]);

    const handleAddNote = async () => {
        if (!newNote.trim() || !currentUserEmployee) return;

        const mentions = newNote.match(/@(\w+)/g)?.map(m => m.substring(1)) || [];
        const mentionedIds = allEmployees
            .filter(e => mentions.some(m => e.name.toLowerCase().includes(m.toLowerCase())))
            .map(e => e.id);

        const newNoteData: Omit<EngagementNote, 'id'> = {
            engagementId: "", // Not linked to a specific engagement
            clientId: clientId,
            text: newNote.trim(),
            category: "Permanent File",
            createdBy: currentUserEmployee.id,
            createdAt: new Date().toISOString(),
            mentions: mentionedIds
        };
        
        try {
            const docRef = doc(collection(db, "engagementNotes"));
            await setDoc(docRef, {...newNoteData, id: docRef.id});
            setNewNote("");
            toast({ title: "Note added", description: "The permanent file has been updated." });
        } catch (error) {
            console.error("Error adding note:", error);
            toast({ title: "Error", description: "Could not add the note.", variant: "destructive"});
        }
    };
    
    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Book /> Permanent File</CardTitle>
                <CardDescription>Important, long-term notes about {clientName}.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col gap-4">
                <ScrollArea className="flex-grow h-[300px] pr-4">
                     <div className="space-y-4">
                        {notes.length > 0 ? notes.map(note => (
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
                            <div className="text-center text-muted-foreground pt-10">No notes in the permanent file yet.</div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
             <CardFooter className="pt-4 border-t">
                 <div className="flex w-full items-center gap-2">
                    <Textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add to permanent file..."
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
