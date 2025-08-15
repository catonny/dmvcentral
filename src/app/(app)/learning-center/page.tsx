
"use client";

import * as React from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Workshop, LearningLog, Employee } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { WorkshopList } from "@/components/learning/workshop-list";
import { LearningLogList } from "@/components/learning/learning-log-list";


export default function LearningCenterPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [workshops, setWorkshops] = React.useState<Workshop[]>([]);
    const [learningLogs, setLearningLogs] = React.useState<LearningLog[]>([]);
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
    const [currentUser, setCurrentUser] = React.useState<Employee | null>(null);
    const [loading, setLoading] = React.useState(true);
    
    React.useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
            const employeesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
            setAllEmployees(employeesData);
            const currentUserProfile = employeesData.find(e => e.email === user.email);
            setCurrentUser(currentUserProfile || null);

            // Fetch logs only after we have the current user's ID
            if (currentUserProfile) {
                const logsQuery = query(collection(db, "learningLogs"), where("userId", "==", currentUserProfile.id));
                const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
                    setLearningLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LearningLog)));
                    setLoading(false);
                }, (err) => {
                    toast({ title: "Error", description: "Could not fetch your learning logs.", variant: "destructive" });
                    setLoading(false);
                });
                return unsubLogs; // This will be cleaned up by the outer return function
            } else {
                 setLoading(false);
            }
        }, (err) => {
            toast({ title: "Error", description: "Could not fetch employees.", variant: "destructive" });
            setLoading(false);
        });
        
        const unsubWorkshops = onSnapshot(collection(db, "workshops"), (snapshot) => {
            setWorkshops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workshop)));
        }, (err) => toast({ title: "Error", description: "Could not fetch workshops.", variant: "destructive" }));
        
        
        return () => {
            unsubEmployees();
            unsubWorkshops();
            // The logs unsub is handled inside the employee fetcher
        }
    }, [user, toast]);
    
    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">Learning Center</h2>
                    <p className="text-muted-foreground">
                        Manage professional development and track learning hours.
                    </p>
                </div>
            </div>
            
             <Tabs defaultValue="workshops" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="workshops">Workshops</TabsTrigger>
                    <TabsTrigger value="logs">Learning Logs</TabsTrigger>
                </TabsList>
                <TabsContent value="workshops">
                    <WorkshopList 
                        workshops={workshops} 
                        allEmployees={allEmployees} 
                        currentUser={currentUser}
                    />
                </TabsContent>
                <TabsContent value="logs">
                     <LearningLogList 
                        learningLogs={learningLogs} 
                        allEmployees={allEmployees} 
                        currentUser={currentUser}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
