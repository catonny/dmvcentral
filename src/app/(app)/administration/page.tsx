"use client";

import * as React from "react";
import { collection, query, onSnapshot, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Employee } from "@/lib/data";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Receipt, Repeat, Mail, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const ActionCard = ({ title, description, icon: Icon, onClick }: { title: string, description: string, icon: React.ElementType, onClick: () => void }) => (
    <Card
        className="cursor-pointer hover:border-primary/80 hover:shadow-lg transition-all group"
        onClick={onClick}
    >
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="flex items-center gap-3 text-xl font-headline">
                        <Icon className="h-6 w-6 text-primary" />
                        {title}
                    </CardTitle>
                    <CardDescription className="mt-2">{description}</CardDescription>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
        </CardHeader>
    </Card>
);


export default function AdministrationPage() {
    const { user, loading: authLoading } = useAuth();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const router = useRouter();
    
    React.useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setLoading(false);
            return;
        }

        const checkUserRole = async () => {
            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const employeeSnapshot = await getDocs(employeeQuery);
            if (!employeeSnapshot.empty) {
                const employeeData = employeeSnapshot.docs[0].data() as Employee;
                if (employeeData.role.includes("Partner") || employeeData.role.includes("Administration")) {
                    setHasAccess(true);
                }
            }
            setLoading(false);
        };
        checkUserRole();
    }, [user, authLoading]);

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
                <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
                <CardContent><p>You do not have the required permissions to view this page.</p></CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">Administration</h2>
                    <p className="text-muted-foreground">
                        Manage firm-wide administrative tasks like billing and client communication.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ActionCard 
                    title="Billing Dashboard"
                    description="View engagements submitted for billing and process invoices."
                    icon={Receipt}
                    onClick={() => router.push('/administration/billing')}
                />
                 <ActionCard 
                    title="Recurring Engagements"
                    description="Manage all recurring service subscriptions for your clients."
                    icon={Repeat}
                    onClick={() => router.push('/administration/recurring')}
                />
                 <ActionCard 
                    title="Email Center"
                    description="Generate and send templated emails to your clients using AI."
                    icon={Mail}
                    onClick={() => router.push('/administration/email-center')}
                />
            </div>
        </div>
    )
}
