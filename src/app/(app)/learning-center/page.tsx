
"use client";

import * as React from "react";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Workshop, LearningLog, Employee, Permission, FeatureName } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { WorkshopList } from "@/components/learning/workshop-list";
import { LearningLogList } from "@/components/learning/learning-log-list";


export default function LearningCenterPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [workshops, setWorkshops] = React.useState<Workshop[]>([]);
    const [learningLogs, setLearningLogs] = React.useState<LearningLog[]>([]);
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
    const [currentUser, setCurrentUser] = React.useState<Employee | null>(null);
    const [loading, setLoading] = React.useState(true);
    
     React.useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setLoading(false);
            return;
        }

        const checkUserRole = async () => {
            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const permissionsQuery = query(collection(db, "permissions"), where("feature", "==", "learning-center"));
            
            const [employeeSnapshot, permissionsSnapshot] = await Promise.all([
                getDocs(employeeQuery),
                getDocs(permissionsQuery)
            ]);

            if (!employeeSnapshot.empty) {
                const employeeData = employeeSnapshot.docs[0].data() as Employee;
                setCurrentUser(employeeData);

                if (permissionsSnapshot.empty) {
                     // Default to admin/partner access if no permissions are set
                    if (employeeData.role.includes("Admin") || employeeData.role.includes("Partner")) {
                        setHasAccess(true);
                    }
                } else {
                    const permission = permissionsSnapshot.docs[0].data() as Permission;
                    if (employeeData.role.some(role => permission.departments.includes(role))) {
                        setHasAccess(true);
                    }
                }
            }
        };

        checkUserRole();

    }, [user, authLoading]);


    React.useEffect(() => {
        if (!hasAccess) {
            setLoading(false);
            return;
        }

        const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
            const employeesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
            setAllEmployees(employeesData);
        }, (err) => {
            toast({ title: "Error", description: "Could not fetch employees.", variant: "destructive" });
        });
        
        const unsubWorkshops = onSnapshot(collection(db, "workshops"), (snapshot) => {
            setWorkshops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workshop)));
        }, (err) => toast({ title: "Error", description: "Could not fetch workshops.", variant: "destructive" }));
        
        // Fetch logs only for the current user, as it's their personal log
        if (currentUser) {
            const logsQuery = query(collection(db, "learningLogs"), where("userId", "==", currentUser.id));
            const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
                setLearningLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LearningLog)));
                setLoading(false);
            }, (err) => {
                toast({ title: "Error", description: "Could not fetch your learning logs.", variant: "destructive" });
                setLoading(false);
            });
            return () => {
                unsubEmployees();
                unsubWorkshops();
                unsubLogs();
            }
        } else {
            setLoading(false);
             return () => {
                unsubEmployees();
                unsubWorkshops();
            }
        }
    }, [user, toast, hasAccess, currentUser]);
    
    if (loading || authLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Access Denied</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Your department does not have access to the Learning Center. Please contact an administrator.</p>
                </CardContent>
            </Card>
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
