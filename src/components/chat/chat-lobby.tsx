
"use client";

import * as React from "react";
import { collection, query, where, onSnapshot, orderBy, doc, getDocs, addDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, PlusCircle, Send } from "lucide-react";
import { format, formatDistanceToNow, isSameDay, parseISO } from "date-fns";
import type { ChatThread, Employee, ChatMessage } from "@/lib/data";
import { cn } from "@/lib/utils";
import { ChatMessageBubble } from "./chat-message";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { Checkbox } from "../ui/checkbox";
import { useToast } from "@/hooks/use-toast";

interface ChatLobbyProps {
    currentUser: Employee | null;
    threads: ChatThread[];
    allEmployees: Employee[];
}

function NewChatDialog({ isOpen, onClose, currentUser, allEmployees, onStartChat }: { isOpen: boolean, onClose: () => void, currentUser: Employee, allEmployees: Employee[], onStartChat: (selectedIds: string[]) => void }) {
    const [selectedEmployees, setSelectedEmployees] = React.useState<string[]>([]);
    
    const handleToggle = (id: string) => {
        setSelectedEmployees(prev => 
            prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]
        );
    }
    
    const handleStart = () => {
        onStartChat(selectedEmployees);
        onClose();
        setSelectedEmployees([]);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Start a New Chat</DialogTitle>
                    <DialogDescription>Select one or more team members to start a conversation.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                     <Command>
                        <CommandInput placeholder="Search employees..." />
                        <CommandList>
                           <CommandEmpty>No results found.</CommandEmpty>
                           <CommandGroup>
                            {allEmployees.filter(e => e.id !== currentUser.id).map(employee => (
                                <CommandItem
                                key={employee.id}
                                onSelect={() => handleToggle(employee.id)}
                                >
                                <Checkbox checked={selectedEmployees.includes(employee.id)} className="mr-2"/>
                                {employee.name}
                                </CommandItem>
                            ))}
                           </CommandGroup>
                        </CommandList>
                      </Command>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleStart} disabled={selectedEmployees.length === 0}>Start Chat</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function ChatLobby({ currentUser, threads, allEmployees }: ChatLobbyProps) {
    const [selectedThread, setSelectedThread] = React.useState<ChatThread | null>(threads.length > 0 ? threads[0] : null);
    const [messages, setMessages] = React.useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = React.useState("");
    const [isNewChatOpen, setIsNewChatOpen] = React.useState(false);
    const { toast } = useToast();

    React.useEffect(() => {
        if (threads.length > 0 && !selectedThread) {
            setSelectedThread(threads[0]);
        }
    }, [threads, selectedThread]);

    React.useEffect(() => {
        if (!selectedThread) {
            setMessages([]);
            return;
        }

        const q = query(
            collection(db, "chatMessages"),
            where("threadId", "==", selectedThread.id),
            orderBy("timestamp", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => doc.data() as ChatMessage));
        });

        return () => unsubscribe();

    }, [selectedThread]);
    
    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedThread || !currentUser) return;
        const now = new Date().toISOString();

        try {
            const messageRef = doc(collection(db, "chatMessages"));
            const message: ChatMessage = {
                id: messageRef.id,
                threadId: selectedThread.id,
                senderId: currentUser.id,
                text: newMessage,
                timestamp: now
            };
            
            const threadRef = doc(db, "chatThreads", selectedThread.id);
            
            const batch = db.batch();
            batch.set(messageRef, message);
            batch.update(threadRef, { 
                lastMessage: { text: newMessage, senderId: currentUser.id, timestamp: now },
                updatedAt: now
            });

            await batch.commit();

            setNewMessage("");

        } catch (error) {
            console.error("Error sending message:", error);
        }
    }

    const handleStartChat = async (selectedIds: string[]) => {
        if (!currentUser) return;

        const participantIds = [...new Set([currentUser.id, ...selectedIds])].sort();

        // Check if a thread with these exact participants already exists
        const existingThread = threads.find(t => {
            const sortedThreadParticipants = [...t.participants].sort();
            return JSON.stringify(sortedThreadParticipants) === JSON.stringify(participantIds);
        });

        if (existingThread) {
            setSelectedThread(existingThread);
            toast({ title: "Chat already exists", description: "Opening the existing conversation." });
            return;
        }
        
        // Create new thread
        try {
            const now = new Date().toISOString();
            const newThreadRef = doc(collection(db, "chatThreads"));
            const participantDetails = participantIds.reduce((acc, id) => {
                const employee = allEmployees.find(e => e.id === id);
                if (employee) {
                    acc[id] = { name: employee.name, avatar: employee.avatar };
                }
                return acc;
            }, {} as ChatThread['participantDetails']);

            const newThread: ChatThread = {
                id: newThreadRef.id,
                participants: participantIds,
                participantDetails,
                lastMessage: {
                    text: "Chat started",
                    senderId: 'system',
                    timestamp: now
                },
                updatedAt: now
            };
            await setDoc(newThreadRef, newThread);
            setSelectedThread(newThread);

        } catch (error) {
            console.error("Error starting chat:", error);
            toast({ title: "Error", description: "Could not start a new chat.", variant: "destructive" });
        }
    };
    
    const getOtherParticipants = (thread: ChatThread) => {
        if (!currentUser) return [];
        return thread.participants.filter(pId => pId !== currentUser.id)
            .map(pId => thread.participantDetails[pId] || { name: 'Unknown', avatar: '' });
    }

    if (!currentUser) return null;

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[75vh] flex-grow overflow-hidden">
                <Card className="md:col-span-1 flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Conversations</CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => setIsNewChatOpen(true)}>
                            <PlusCircle />
                        </Button>
                    </CardHeader>
                    <ScrollArea className="flex-grow">
                        <CardContent className="space-y-1">
                            {threads.map(thread => {
                                const otherParticipants = getOtherParticipants(thread);
                                const otherNames = otherParticipants.map(p => p.name).join(", ");
                                return (
                                    <button
                                        key={thread.id}
                                        className={cn(
                                            "w-full text-left p-3 rounded-lg border transition-colors flex items-center gap-3",
                                            selectedThread?.id === thread.id ? 'bg-muted border-primary' : 'hover:bg-muted/50'
                                        )}
                                        onClick={() => setSelectedThread(thread)}
                                    >
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={otherParticipants[0]?.avatar} />
                                            <AvatarFallback>{otherNames.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-grow">
                                            <div className="flex justify-between items-start">
                                                <p className="font-semibold text-sm">{otherNames}</p>
                                                <p className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {formatDistanceToNow(parseISO(thread.updatedAt), { addSuffix: true })}
                                                </p>
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">{thread.lastMessage.text}</p>
                                        </div>
                                    </button>
                                )
                            })}
                        </CardContent>
                    </ScrollArea>
                </Card>
                <Card className="md:col-span-2 flex flex-col">
                    {selectedThread ? (
                        <>
                            <CardHeader className="border-b">
                                <CardTitle>{getOtherParticipants(selectedThread).map(p=>p.name).join(', ')}</CardTitle>
                            </CardHeader>
                            <ScrollArea className="flex-grow p-4 space-y-4">
                                {messages.map((message) => (
                                    <ChatMessageBubble key={message.id} message={message} currentUser={currentUser} allEmployees={allEmployees} />
                                ))}
                            </ScrollArea>
                            <div className="p-4 border-t flex items-center gap-2">
                                <Input 
                                    placeholder="Type a message..." 
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                />
                                <Button onClick={handleSendMessage} size="icon" disabled={!newMessage.trim()}>
                                    <Send className="h-4 w-4"/>
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <MessageSquare className="h-16 w-16" />
                            <p className="mt-4 font-semibold">Select a conversation</p>
                            <p className="text-sm">Or start a new one to begin chatting.</p>
                        </div>
                    )}
                </Card>
            </div>
             <NewChatDialog
                isOpen={isNewChatOpen}
                onClose={() => setIsNewChatOpen(false)}
                currentUser={currentUser}
                allEmployees={allEmployees}
                onStartChat={handleStartChat}
             />
        </>
    );
}
