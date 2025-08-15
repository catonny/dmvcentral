

"use client";

import * as React from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Users, FileText, AlertTriangle, UserX, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const ActionCard = ({ title, description, icon: Icon, onClick, isDisabled = false }: { title: string, description: string, icon: React.ElementType, onClick: () => void, isDisabled?: boolean }) => (
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

export default function ExceptionReportsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
       <Button variant="outline" size="sm" onClick={() => router.push('/reports')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reports
        </Button>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <AlertTriangle className="text-destructive"/>
            Exception Reports
          </h2>
          <p className="text-muted-foreground">
            Find items and team performance that require your immediate attention.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ActionCard 
                title="Incomplete Client Data"
                description="Find clients with missing mandatory information like PAN or email."
                icon={Users}
                onClick={() => router.push('/reports/exceptions/incomplete-clients')}
            />
             <ActionCard 
                title="Unbilled Engagements"
                description="Engagements marked 'Completed' but not yet submitted for billing."
                icon={FileText}
                onClick={() => router.push('/reports/exceptions/unbilled-engagements')}
            />
             <ActionCard 
                title="Overdue Engagements"
                description="Active engagements that have passed their due date."
                icon={FileText}
                onClick={() => router.push('/reports/exceptions/overdue-engagements')}
            />
             <ActionCard 
                title="Monthly Hours Deficit"
                description="Employees who have not met their monthly target hours."
                icon={UserX}
                onClick={() => router.push('/reports/exceptions/monthly-hours-deficit')}
            />
             <ActionCard 
                title="Budget Overruns"
                description="Engagements where logged hours exceed the budgeted hours."
                icon={Hourglass}
                onClick={() => router.push('/reports/exceptions/budget-overruns')}
            />
        </div>
    </div>
  );
}
