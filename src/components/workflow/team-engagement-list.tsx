
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Search } from "lucide-react";
import type { Task, Client, Engagement, EngagementType, EngagementStatus } from "@/lib/data";
import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";
import { Badge } from "../ui/badge";
import Link from "next/link";
import { Progress } from "../ui/progress";

interface TeamEngagementListProps {
  engagements: Engagement[];
  tasks: Task[];
  clients: Client[];
  engagementTypes: EngagementType[];
}

type GroupBy = "client" | "type";

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
  const [groupBy, setGroupBy] = React.useState<GroupBy>("client");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(new Set());
  
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
      });
  }, [engagements, tasks, clientMap, engagementTypeMap, searchTerm]);
  
  const groupedEngagements = React.useMemo(() => {
    return enrichedAndFilteredEngagements.reduce((acc, eng) => {
      const key = groupBy === "client" ? eng.clientId : eng.type;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(eng);
      return acc;
    }, {} as Record<string, EnrichedEngagement[]>);
  }, [enrichedAndFilteredEngagements, groupBy]);
  
  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const getGroupName = (groupId: string) => {
      if (groupBy === 'client') {
          return clientMap.get(groupId)?.name || "Unknown Client";
      }
      return engagementTypeMap.get(groupId)?.name || "Unknown Type";
  }

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
        <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Group by:</span>
             <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="type">Engagement Type</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>
       <ScrollArea className="h-[60vh] w-full rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-muted z-10">
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>{groupBy === 'client' ? 'Engagement' : 'Client'}</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Progress</TableHead>
            </TableRow>
          </TableHeader>
          {Object.keys(groupedEngagements).length > 0 ? (
            Object.entries(groupedEngagements).map(([groupId, engagementsInGroup]) => {
                const isOpen = openGroups.has(groupId);
                return (
                    <Collapsible asChild key={groupId} open={isOpen} onOpenChange={() => toggleGroup(groupId)}>
                        <TableBody>
                            <TableRow className="bg-muted/50 font-semibold hover:bg-muted/80">
                                <TableCell>
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
                                        </Button>
                                    </CollapsibleTrigger>
                                </TableCell>
                                <TableCell colSpan={4}>
                                    {getGroupName(groupId)}
                                    <Badge variant="secondary" className="ml-2">{engagementsInGroup.length}</Badge>
                                </TableCell>
                            </TableRow>
                            <CollapsibleContent asChild>
                                <React.Fragment>
                                {engagementsInGroup.map(eng => (
                                     <TableRow key={eng.id}>
                                        <TableCell></TableCell>
                                        <TableCell>
                                            <Link href={`/workflow/${eng.id}`} className="font-medium text-primary hover:underline">
                                                {groupBy === 'client' ? eng.engagementTypeName : eng.clientName}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{eng.remarks}</TableCell>
                                        <TableCell className={cn(isPast(eng.dueDate) && eng.status !== 'Completed' && "text-destructive font-semibold")}>
                                            {format(eng.dueDate, "dd MMM, yyyy")}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                 <Progress value={(eng.completedTaskCount / eng.taskCount) * 100 || 0} className="w-24"/>
                                                 <span className="text-xs text-muted-foreground">
                                                    {eng.completedTaskCount}/{eng.taskCount}
                                                 </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                </React.Fragment>
                            </CollapsibleContent>
                        </TableBody>
                    </Collapsible>
                )
            })
          ) : (
            <TableBody>
                <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        No engagements found.
                    </TableCell>
                </TableRow>
            </TableBody>
          )}
        </Table>
      </ScrollArea>
    </div>
  );
}
