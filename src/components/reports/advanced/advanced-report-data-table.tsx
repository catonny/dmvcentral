
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Engagement, Client, Employee, Task } from "@/lib/data";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AdvancedReportDataTableProps {
  engagements: Engagement[];
  clients: Client[];
  employees: Employee[];
  tasks: Task[];
}

export function AdvancedReportDataTable({
  engagements,
  clients,
  employees,
  tasks
}: AdvancedReportDataTableProps) {
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(new Set());

  const clientMap = React.useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const employeeMap = React.useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);

  const groupedByClient = React.useMemo(() => {
    return engagements.reduce((acc, eng) => {
      if (!acc[eng.clientId]) {
        acc[eng.clientId] = [];
      }
      acc[eng.clientId].push(eng);
      return acc;
    }, {} as Record<string, Engagement[]>);
  }, [engagements]);
  
  const toggleGroup = (clientId: string) => {
    setOpenGroups(prev => {
        const newSet = new Set(prev);
        if (newSet.has(clientId)) {
            newSet.delete(clientId);
        } else {
            newSet.add(clientId);
        }
        return newSet;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Results ({engagements.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[60vh] w-full rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-muted z-10">
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Engagement Remarks</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Assigned To</TableHead>
              </TableRow>
            </TableHeader>
            {Object.keys(groupedByClient).length > 0 ? (
                Object.entries(groupedByClient).map(([clientId, clientEngagements]) => {
                    const isOpen = openGroups.has(clientId);
                    const client = clientMap.get(clientId);

                    return (
                        <Collapsible asChild key={clientId} open={isOpen} onOpenChange={() => toggleGroup(clientId)}>
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
                                        {client?.name || 'Unknown Client'}
                                        <Badge variant="secondary" className="ml-2">{clientEngagements.length}</Badge>
                                    </TableCell>
                                </TableRow>
                                <CollapsibleContent asChild>
                                    <React.Fragment>
                                        {clientEngagements.map(eng => {
                                             const assigned = eng.assignedTo.map(id => employeeMap.get(id)).filter(Boolean) as Employee[];
                                             const isOverdue = isPast(new Date(eng.dueDate)) && eng.status !== "Completed";
                                             return (
                                                <TableRow key={eng.id}>
                                                    <TableCell></TableCell>
                                                    <TableCell colSpan={2}>{eng.remarks}</TableCell>
                                                    <TableCell className={cn(isOverdue && "text-destructive")}>{format(new Date(eng.dueDate), 'dd MMM, yyyy')}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center -space-x-2">
                                                            {assigned.map(emp => (
                                                                <Avatar key={emp.id} className="h-8 w-8 border-2 border-background">
                                                                    <AvatarImage src={emp.avatar} alt={emp.name} />
                                                                    <AvatarFallback>{emp.name.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                             )
                                        })}
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
                        No results match your filter criteria.
                    </TableCell>
                    </TableRow>
                </TableBody>
            )}
          </Table>
           <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
