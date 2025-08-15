
"use client";

import * as React from "react";
import { collection, query, where, onSnapshot, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Communication, Employee, Todo, ChatThread } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Inbox, Link as LinkIcon, Users, FileText, ListChecks, Mail, Bell, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatLobby } from "@/components/chat/chat-lobby";

function ClientEmailInbox({ communications, selectedComm, setSelectedComm }: { communications: Communication[], selectedComm: Communication | null, setSelectedComm: (comm: Communication | null) => void }) {
    if (communications.length === 0) {
        return (
            <div className="flex-grow flex items-center justify-center">
                <Card className="text-center p-8 border-dashed">
                    <Inbox className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">Email Inbox Empty</h3>
                    <p className="mt-2 text-sm text-muted-foreground">There are no new client emails for you.</p>
                </Card>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow overflow-hidden">
            <Card className="md:col-span-1 flex flex-col">
                <CardHeader>
                    <CardTitle>Client Emails</CardTitle>
                </CardHeader>
                <ScrollArea className="flex-grow">
                <CardContent className="space-y-2">
                   {communications.map(comm => (
                       <button
                        key={comm.id}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedComm?.id === comm.id ? 'bg-muted border-primary' : 'hover:bg-muted/50'}`}
                        onClick={() => setSelectedComm(comm)}
                        >
                           <div className="flex justify-between items-start">
                                <p className="font-semibold text-sm">{comm.clientName}</p>
                                <p className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(comm.receivedAt), { addSuffix: true })}</p>
                           </div>
                            <p className="text-xs text-muted-foreground truncate">{comm.subject}</p>
                       </button>
                   ))}
                </CardContent>
                </ScrollArea>
            </Card>
            {selectedComm && (
                <Card className="md:col-span-2 flex flex-col">
                   <ScrollArea className="h-full">
                   <CardHeader className="flex flex-row items-start justify-between">
                        <div>
                            <Badge variant={selectedComm.category === 'Urgent' ? 'destructive' : 'secondary'}>{selectedComm.category}</Badge>
                            <CardTitle className="mt-2">{selectedComm.subject}</CardTitle>
                            <CardDescription>From: {selectedComm.from} | To: You</CardDescription>
                        </div>
                        {selectedComm.clientId && (
                            <Button asChild variant="outline">
                                <Link href={`/workspace/${selectedComm.clientId}`}>
                                    <LinkIcon className="mr-2 h-4 w-4" />
                                    Client Workspace
                                </Link>
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="flex items-center text-lg font-semibold mb-2"><FileText className="mr-2 h-4 w-4"/> AI Summary</h4>
                            <p className="text-sm bg-muted p-4 rounded-md">{selectedComm.summary}</p>
                        </div>
                         {selectedComm.actionItems && selectedComm.actionItems.length > 0 && (
                             <div>
                                <h4 className="flex items-center text-lg font-semibold mb-2"><ListChecks className="mr-2 h-4 w-4"/> Action Items</h4>
                                <ul className="list-disc list-inside space-y-1 bg-muted p-4 rounded-md text-sm">
                                    {selectedComm.actionItems.map((item, index) => <li key={index}>{item}</li>)}
                                </ul>
                            </div>
                         )}
                          <div>
                            <h4 className="flex items-center text-lg font-semibold mb-2"><Users className="mr-2 h-4 w-4"/> Visible To</h4>
                             <p className="text-sm text-muted-foreground">The AI has determined this email is relevant to the partners and employees assigned to this client.</p>
                        </div>
                        <div>
                            <h4 className="text-lg font-semibold mb-2">Original Message</h4>
                            <div className="text-sm bg-muted p-4 rounded-md whitespace-pre-wrap font-mono">{selectedComm.body}</div>
                        </div>
                    </CardContent>
                   </ScrollArea>
                </Card>
            )}
        </div>
    )
}

function NotificationsInbox() {
    return (
         <div className="flex-grow flex items-center justify-center">
            <Card className="text-center p-8 border-dashed w-full max-w-md">
                <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No new notifications</h3>
                <p className="mt-2 text-sm text-muted-foreground">Mentions and other alerts will appear here.</p>
            </Card>
        </div>
    )
}

export default function InboxPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [communications, setCommunications] = React.useState<Communication[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedComm, setSelectedComm] = React.useState<Communication | null>(null);
    const [currentUserEmployee, setCurrentUserEmployee] = React.useState<Employee | null>(null);
    const [chatThreads, setChatThreads] = React.useState<ChatThread[]>([]);
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
    
    const [unreadEmails, setUnreadEmails] = React.useState(0);
    const [unreadNotifications, setUnreadNotifications] = React.useState(0);
    const [unreadChats, setUnreadChats] = React.useState(0);


    React.useEffect(() => {
        if (!user) return;
        setLoading(true);

        const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
            setAllEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
        });

        const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
        const unsubCurrentUser = onSnapshot(employeeQuery, (employeeSnapshot) => {
            if (!employeeSnapshot.empty) {
                const employeeProfile = { id: employeeSnapshot.docs[0].id, ...employeeSnapshot.docs[0].data() } as Employee;
                setCurrentUserEmployee(employeeProfile);

                const commsQuery = query(
                    collection(db, "communications"),
                    where("visibleTo", "array-contains", employeeProfile.id),
                    orderBy("receivedAt", "desc")
                );

                const unsubComms = onSnapshot(commsQuery, (snapshot) => {
                    const commsData = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Communication);
                    setCommunications(commsData);
                    setUnreadEmails(commsData.length); // Placeholder for real unread logic
                    if (commsData.length > 0 && !selectedComm) {
                        setSelectedComm(commsData[0]);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Error fetching communications:", error);
                    toast({ title: "Error", description: "Could not fetch inbox data.", variant: "destructive" });
                    setLoading(false);
                });

                const chatQuery = query(
                    collection(db, 'chatThreads'),
                    where('participants', 'array-contains', employeeProfile.id),
                    orderBy('updatedAt', 'desc')
                );

                const unsubChat = onSnapshot(chatQuery, (snapshot) => {
                    setChatThreads(snapshot.docs.map(d => ({id: d.id, ...d.data()} as ChatThread)));
                });
                
                return () => {
                    unsubComms();
                    unsubChat();
                };

            } else {
                setLoading(false);
                toast({ title: "Error", description: "Could not find your employee profile.", variant: "destructive"});
            }
        });
        
        return () => {
            unsubEmployees();
            unsubCurrentUser();
        };

    }, [user, toast, selectedComm]);

    if (loading || authLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex-shrink-0 mb-4">
                <h2 className="text-3xl font-bold tracking-tight font-headline">Inbox</h2>
                <p className="text-muted-foreground">
                    Your central hub for all communications.
                </p>
            </div>
            <Tabs defaultValue="emails" className="flex-grow flex flex-col">
                <TabsList className="grid w-full grid-cols-3 max-w-lg">
                    <TabsTrigger value="emails">
                        <Mail className="mr-2" /> Emails
                        {unreadEmails > 0 && <Badge className="ml-2">{unreadEmails}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="notifications">
                        <Bell className="mr-2" /> Notifications
                        {unreadNotifications > 0 && <Badge className="ml-2">{unreadNotifications}</Badge>}
                    </TabsTrigger>
                     <TabsTrigger value="chats">
                        <MessageSquare className="mr-2" /> Chats
                        {unreadChats > 0 && <Badge className="ml-2">{unreadChats}</Badge>}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="emails" className="flex-grow mt-4">
                   <ClientEmailInbox communications={communications} selectedComm={selectedComm} setSelectedComm={setSelectedComm}/>
                </TabsContent>
                <TabsContent value="notifications" className="flex-grow mt-4">
                    <NotificationsInbox />
                </TabsContent>
                <TabsContent value="chats" className="flex-grow mt-4">
                    <ChatLobby
                        currentUser={currentUserEmployee}
                        threads={chatThreads}
                        allEmployees={allEmployees}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
