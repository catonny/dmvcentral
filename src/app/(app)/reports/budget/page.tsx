
"use client";

import * as React from "react";
import { collection, onSnapshot, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Employee, Expense, Budget, RecurringEngagement, Engagement } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Banknote } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ExpenseManager } from "@/components/reports/budget/expense-manager";
import { CashFlowForecast } from "@/components/reports/budget/cash-flow-forecast";

export default function BudgetAndForecastPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [hasAccess, setHasAccess] = React.useState(false);
    const [loading, setLoading] = React.useState(true);

    const [expenses, setExpenses] = React.useState<Expense[]>([]);
    const [recurringEngagements, setRecurringEngagements] = React.useState<RecurringEngagement[]>([]);
    const [oneTimeEngagements, setOneTimeEngagements] = React.useState<Engagement[]>([]);

    React.useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const checkUserRole = async () => {
            const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
            const employeeSnapshot = await getDocs(employeeQuery);
            if (!employeeSnapshot.empty) {
                const employeeData = employeeSnapshot.docs[0].data() as Employee;
                if (employeeData.role.includes("Partner") || employeeData.role.includes("Admin")) {
                    setHasAccess(true);
                }
            }
            setLoading(false);
        };
        checkUserRole();
    }, [user]);

    React.useEffect(() => {
        if (!hasAccess) return;

        const unsubExpenses = onSnapshot(collection(db, "expenses"), (snapshot) => {
            setExpenses(snapshot.docs.map(doc => doc.data() as Expense));
        });

        const unsubRecurring = onSnapshot(query(collection(db, "recurringEngagements"), where("isActive", "==", true)), (snapshot) => {
            setRecurringEngagements(snapshot.docs.map(doc => doc.data() as RecurringEngagement));
        });

        // Fetch one-time engagements (not recurring) that are not completed or cancelled
        const unsubOneTime = onSnapshot(query(collection(db, "engagements"), where("status", "in", ["Pending", "In Process", "Awaiting Documents", "Partner Review"])), (snapshot) => {
            const allActiveEngagements = snapshot.docs.map(doc => doc.data() as Engagement);
            // This client-side filter is necessary because Firestore doesn't support "not-exists" queries on fields.
            const oneTime = allActiveEngagements.filter(e => !e.recurringEngagementId);
            setOneTimeEngagements(oneTime);
        });

        return () => {
            unsubExpenses();
            unsubRecurring();
            unsubOneTime();
        };

    }, [hasAccess]);


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
                    <p>You do not have the required permissions to view this page.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Button variant="outline" size="sm" onClick={() => router.push('/reports')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Reports
            </Button>

             <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-3">
                        <Banknote/>
                        Budget & Cash Flow Forecast
                    </h2>
                    <p className="text-muted-foreground">
                        Manage your firm's expenses and project future cash flow based on revenue and costs.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <ExpenseManager initialExpenses={expenses} />
                </div>
                <div className="lg:col-span-2">
                    <CashFlowForecast 
                        expenses={expenses}
                        recurringEngagements={recurringEngagements}
                        oneTimeEngagements={oneTimeEngagements}
                    />
                </div>
            </div>
        </div>
    );
}
