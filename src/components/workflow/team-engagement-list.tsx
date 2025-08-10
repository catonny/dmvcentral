
"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import type { Task, Client, Engagement, EngagementType, EngagementStatus } from "@/lib/data";
import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";
import Link from "next/link";
import { Progress } from "../ui/progress";

interface TeamEngagementListProps {
  engagements: Engagement[];
  tasks: Task[];
  clients: Client[];
  engagementTypes: EngagementType[];
}

type GroupBy = "client" | "type" | "none";

interface EnrichedEngagement extends Engagement {
  clientName: string;
  engagementTypeName: string;
  taskCount: number;
  completedTaskCount: number;
}

export function TeamEngagementList({
  engagements,
  tasks,
  clients,
  engagementTypes,
}: TeamEngagementListProps) {
  const [groupBy, setGroupBy] = React.useState<GroupBy>("none");
  const [searchTerm, setSearchTerm] = React.useState("");
  
  const clientMap = React.useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const engagementTypeMap = React.useMemo(() => new Map(engagementTypes.map(et => [et.id, et])), [engagementTypes]);

  const enrichedAndFilteredEngagements = React.useMemo(() => {
    return engagements
      .map(eng => {
        const engagementTasks = tasks.filter(t => t.engagementId === eng.id);
        const completedTasks = engagementTasks.filter(t => t.status === "Completed").length;
        
        return {
          ...eng,
          clientName: clientMap.get(eng.clientId)?.name || "Unknown Client",
          engagementTypeName: engagementTypeMap.get(eng.type)?.name || "Unknown Type",
          taskCount: engagementTasks.length,
          completedTaskCount: completedTasks,
        };
      })
      .filter(eng => {
        if (!searchTerm) return true;
        const lowerSearch = searchTerm.toLowerCase();
        return (
          eng.clientName.toLowerCase().includes(lowerSearch) ||
          eng.engagementTypeName.toLowerCase().includes(lowerSearch) ||
          eng.remarks.toLowerCase().includes(lowerSearch)
        );
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [engagements, tasks, clientMap, engagementTypeMap, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search engagements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
            />
        </div>
      </div>
       <ScrollArea className="h-[60vh] w-full rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-muted z-10">
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Engagement</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrichedAndFilteredEngagements.length > 0 ? (
                enrichedAndFilteredEngagements.map(eng => {
                    const progress = (eng.completedTaskCount / eng.taskCount) * 100 || 0;
                    return (
                         <TableRow key={eng.id}>
                            <TableCell>
                                <Link href={`/workspace/${eng.clientId}`} className="font-medium text-primary hover:underline">
                                    {eng.clientName}
                                </Link>
                            </TableCell>
                            <TableCell>
                                 <Link href={`/workflow/${eng.id}`} className="hover:underline">
                                    {eng.engagementTypeName}
                                </Link>
                            </TableCell>
                            <TableCell>{eng.remarks}</TableCell>
                            <TableCell className={cn(isPast(eng.dueDate) && eng.status !== 'Completed' && "text-destructive font-semibold")}>
                                {format(eng.dueDate, "dd MMM, yyyy")}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                        <Progress value={progress} className="w-24"/>
                                        <span className="text-xs text-muted-foreground">
                                        {eng.completedTaskCount}/{eng.taskCount}
                                        </span>
                                </div>
                            </TableCell>
                        </TableRow>
                    )
                })
            ) : (
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        No engagements found.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
