

"use client";

import * as React from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Eye, PenSquare, PlusCircle, GitBranch, Group, Building } from "lucide-react";
import { ViewMasterData } from "@/components/masters/view-master-data";
import { CreateMasterData } from "@/components/masters/create-master-data";
import { AlterMasterData } from "@/components/masters/alter-master-data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { WorkflowEditor } from "@/components/masters/workflow-editor";
import { EmployeeManager } from "@/components/masters/employee-manager";
import { useRouter } from "next/navigation";

type Action = "view" | "create" | "alter" | "workflow" | "employee" | "firms" | null;

export default function MastersPage() {
  const [currentAction, setCurrentAction] = React.useState<Action>(null);
  const router = useRouter();

  const handleActionClick = (action: Action) => {
      if (action === 'firms') {
          router.push('/masters/firms');
      } else {
        setCurrentAction(action);
      }
  };

  const renderContent = () => {
    switch (currentAction) {
      case "view":
        return <ViewMasterData onBack={() => setCurrentAction(null)} />;
      case "create":
        return <CreateMasterData onBack={() => setCurrentAction(null)} />;
      case "alter":
        return <AlterMasterData onBack={() => setCurrentAction(null)} />;
      case "workflow":
        return <WorkflowEditor onBack={() => setCurrentAction(null)} />;
      case "employee":
        return <EmployeeManager onBack={() => setCurrentAction(null)} />;
      default:
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ActionCard
                    title="Manage Firms"
                    description="Edit your firm's profile, address, and other details."
                    icon={Building}
                    onClick={() => handleActionClick("firms")}
                />
                <ActionCard
                    title="Manage Employees"
                    description="Add, edit, and manage employee profiles and department assignments."
                    icon={Group}
                    onClick={() => handleActionClick("employee")}
                />
                <ActionCard
                    title="Edit Engagement Workflows"
                    description="Define the sequence of tasks for different engagement types."
                    icon={GitBranch}
                    onClick={() => handleActionClick("workflow")}
                />
                <ActionCard
                    title="View Master Data"
                    description="Browse through existing master records like clients and engagement types."
                    icon={Eye}
                    onClick={() => handleActionClick("view")}
                />
                 <ActionCard
                    title="Create New Entry"
                    description="Add a new record to one of your master data sets."
                    icon={PlusCircle}
                    onClick={() => handleActionClick("create")}
                />
                <ActionCard
                    title="Alter Master Data"
                    description="Edit or delete existing records from your master data sets."
                    icon={PenSquare}
                    onClick={() => handleActionClick("alter")}
                />
            </div>
        );
    }
  };

  return (
    <>
      <div className="flex items-center justify-between space-y-2 mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Masters</h2>
          <p className="text-muted-foreground">
            Manage your core business data like clients, employees, and work types.
          </p>
        </div>
      </div>
      {renderContent()}
    </>
  );
}

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
            {!isDisabled ? (
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            ) : (
                <Badge variant="outline">Coming Soon</Badge>
            )}
        </div>
      </div>
    </CardHeader>
  </Card>
);
