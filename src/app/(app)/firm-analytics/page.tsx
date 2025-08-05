
"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Engagement, Employee, Client, EngagementType } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Users, Repeat, HandCoins, UserCheck, UserX } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";

const RECURRING_KEYWORDS = ["book keeping", "gst filing", "monthly", "quarterly"];

function KpiCard({ title, value, description, icon: Icon, valuePrefix = "", valueSuffix = "" }: { title: string, value: string | number, description: string, icon: React.ElementType, valuePrefix?: string, valueSuffix?: string }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                    {valuePrefix}{value}{valueSuffix}
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>
            </CardContent>
        </Card>
    );
}


export default function FirmAnalyticsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);

    const [clients, setClients] = React.useState<Client[]>([]);
    const [engagements, setEngagements] = React.useState<Engagement[]>([]);
    
    React.useEffect(() => {
        if (!user) return;
        
        const checkUserRole = async () => {
            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const employeeSnapshot = await getDocs(employeeQuery);
            if (!employeeSnapshot.empty) {
                const employeeData = employeeSnapshot.docs[0].data() as Employee;
                if (employeeData.role.includes("Partner")) {
                    setHasAccess(true);
                }
            }
        };
        checkUserRole();

    }, [user]);
    
    React.useEffect(() => {
        if (!hasAccess) {
             setLoading(false);
             return;
        }

        const unsubClients = onSnapshot(collection(db, "clients"), (snapshot) => {
            setClients(snapshot.docs.map(doc => doc.data() as Client));
        }, (err) => {
            toast({ title: "Error", description: "Could not fetch clients.", variant: "destructive" });
        });

        const unsubEngagements = onSnapshot(collection(db, "engagements"), (snapshot) => {
            setEngagements(snapshot.docs.map(doc => doc.data() as Engagement));
            setLoading(false);
        }, (err) => {
            toast({ title: "Error", description: "Could not fetch engagements.", variant: "destructive" });
            setLoading(false);
        });

        return () => {
            unsubClients();
            unsubEngagements();
        }

    }, [hasAccess, toast]);

    const kpiData = React.useMemo(() => {
        if (clients.length === 0 || engagements.length === 0) {
            return {
                clientLifetimeValue: 0,
                churnRate: 0,
                monthlyRecurringRevenue: 0,
                averageRevenuePerClient: 0,
            };
        }

        const completedEngagements = engagements.filter(e => e.status === 'Completed' && e.fees);
        const totalRevenue = completedEngagements.reduce((sum, e) => sum + (e.fees || 0), 0);
        const activeClients = new Set(completedEngagements.map(e => e.clientId));

        // Average Revenue Per Client (ARPC)
        const averageRevenuePerClient = activeClients.size > 0 ? totalRevenue / activeClients.size : 0;
        
        // Client Lifetime & Value (CLV)
        let totalLifespanDays = 0;
        activeClients.forEach(clientId => {
            const client = clients.find(c => c.id === clientId);
            if (client && client.createdAt) {
                totalLifespanDays += differenceInDays(new Date(), parseISO(client.createdAt));
            }
        });
        const averageLifespanDays = activeClients.size > 0 ? totalLifespanDays / activeClients.size : 0;
        const clientLifetimeValue = averageRevenuePerClient * (averageLifespanDays / 365); // Simplified CLV

        // Churn Rate (Clients with no activity in the last year)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const clientsWithRecentActivity = new Set(engagements.filter(e => parseISO(e.dueDate) > oneYearAgo).map(e => e.clientId));
        const churnedClients = clients.filter(c => !clientsWithRecentActivity.has(c.id)).length;
        const churnRate = clients.length > 0 ? (churnedClients / clients.length) * 100 : 0;
        
        // Monthly Recurring Revenue (MRR)
        const recurringEngagements = completedEngagements.filter(e => 
            RECURRING_KEYWORDS.some(keyword => e.remarks.toLowerCase().includes(keyword))
        );
        const monthlyRecurringRevenue = recurringEngagements.reduce((sum, e) => sum + (e.fees || 0), 0);

        return {
            clientLifetimeValue,
            churnRate,
            monthlyRecurringRevenue,
            averageRevenuePerClient
        };

    }, [clients, engagements]);


    if (loading) {
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
                    <p>You do not have the required permissions to view this page. This view is for Partners only.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
             <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">Firm Analytics</h2>
                    <p className="text-muted-foreground">
                        Key Performance Indicators based on the Audit Quality Maturity Model.
                    </p>
                </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    title="Client Lifetime Value (CLV)"
                    value={kpiData.clientLifetimeValue.toFixed(0)}
                    valuePrefix="₹"
                    description="Estimated total revenue a client generates over their lifetime."
                    icon={TrendingUp}
                />
                <KpiCard
                    title="Client Churn Rate (Annual)"
                    value={kpiData.churnRate.toFixed(2)}
                    valueSuffix="%"
                    description="Percentage of clients with no activity in the last year."
                    icon={UserX}
                />
                 <KpiCard
                    title="Estimated Monthly Recurring Revenue (MRR)"
                    value={(kpiData.monthlyRecurringRevenue / 1000).toFixed(1)}
                    valuePrefix="₹"
                    valueSuffix="k"
                    description="From completed retainership engagements like book keeping."
                    icon={Repeat}
                />
                 <KpiCard
                    title="Average Revenue Per Client (ARPC)"
                    value={kpiData.averageRevenuePerClient.toFixed(0)}
                    valuePrefix="₹"
                    description="Average revenue from all completed engagements per client."
                    icon={HandCoins}
                />
            </div>
        </div>
    )
}
