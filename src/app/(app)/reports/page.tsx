
"use client";

import * as React from "react";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowRight, BarChart, FileText, Users, AlertTriangle, LineChart, SlidersHorizontal, UserX, Repeat, HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { collection, getDocs, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Employee, Engagement } from "@/lib/data";
import { Loader2 } from "lucide-react";
import { WorkloadDistribution } from "@/components/dashboard/workload-distribution";

const ReportCard = ({ title, description, icon: Icon, onClick, isDisabled = false }: { title: string, description: string, icon: React.ElementType, onClick: () => void, isDisabled?: boolean }) => (
  <Card
    className={cn(
        "transition-all group",
        isDisabled ? "cursor-not-allowed bg-muted/50" : "cursor-pointer hover:border-primary/80 hover:shadow-primary/20"
    )}
    onClick={isDisabled ? undefined : onClick}
  >
    <CardHeader>
      <div className="flex justify-between items-start">
        <div>
          <CardTitle className="flex items-center gap-3 text-xl">
            <Icon className={cn("h-6 w-6", isDisabled ? "text-muted-foreground" : "text-primary")} />
            {title}
          </CardTitle>
          <CardDescription className="mt-2">{description}</CardDescription>
        </div>
         <div className="flex flex-col items-end gap-2">
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </CardHeader>
  </Card>
);

export default function ReportsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = React.useState(true);
    const [hasAccess, setHasAccess] = React.useState(false);
    const [engagements, setEngagements] = React.useState<Engagement[]>([]);
    const [employees, setEmployees] = React.useState<Employee[]>([]);

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
                if (employeeData.role.includes("Partner") || employeeData.role.includes("Admin")) {
                    setHasAccess(true);
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
        
        const unsubEngagements = onSnapshot(collection(db, "engagements"), (snapshot) => {
            setEngagements(snapshot.docs.map(doc => doc.data() as Engagement));
            checkDataLoaded();
        });
        
        const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
            setEmployees(snapshot.docs.map(doc => doc.data() as Employee));
            checkDataLoaded();
        });

        const checkDataLoaded = () => {
            if (engagements.length > 0 && employees.length > 0) {
                 setLoading(false);
            }
        }
        
        return () => {
            unsubEngagements();
            unsubEmployees();
        }

    }, [hasAccess, engagements, employees]);

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
                    <p>You do not have the required permissions to view reports.</p>
                </CardContent>
            </Card>
        );
    }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight font-headline">Reports</h2>
        <p className="text-muted-foreground">
          Select a report to view detailed information.
        </p>
      </div>

       <WorkloadDistribution engagements={engagements} employees={employees} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ReportCard 
                title="Engagement Reports"
                description="High-level summary and a detailed list of all engagements."
                icon={FileText}
                onClick={() => router.push('/reports/engagements')}
            />
            <ReportCard 
                title="Exception Reports"
                description="Find clients and engagements that require immediate attention."
                icon={AlertTriangle}
                onClick={() => router.push('/reports/exceptions')}
            />
             <ReportCard 
                title="Accounts Reports"
                description="Access detailed invoice, revenue, and collection reports."
                icon={LineChart}
                onClick={() => router.push('/reports/accounts')}
            />
             <ReportCard 
                title="Firm Analytics (KPIs)"
                description="Key performance indicators for your firm's health and growth."
                icon={BarChart}
                onClick={() => router.push('/reports/kpi-dashboard')}
            />
            <ReportCard 
                title="Custom Reports"
                description="Drill down into engagements with multi-level task and status filters."
                icon={SlidersHorizontal}
                onClick={() => router.push('/reports/advanced-engagement-report')}
            />
        </div>
    </div>
  );
}
