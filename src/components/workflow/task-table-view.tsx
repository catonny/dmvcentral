
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
import { Card, CardContent } from "@/components/ui/card";
import type { Task, Client, Engagement, TaskStatus } from "@/lib/data";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Input } from "../ui/input";

interface TaskTableViewProps {
  tasks: Task[];
  engagements: Engagement[];
  clients: Map<string, Client>;
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

export function TaskTableView({
  tasks,
  engagements,
  clients,
  onTaskStatusChange,
}: TaskTableViewProps) {
  const [filter, setFilter] = React.useState("pending");
  const [searchTerm, setSearchTerm] = React.useState("");

  const engagementMap = React.useMemo(
    () => new Map(engagements.map((e) => [e.id, e])),
    [engagements]
  );

  const enrichedTasks = React.useMemo(() => {
    return tasks
      .map((task) => {
        const engagement = engagementMap.get(task.engagementId);
        if (!engagement) return null;
        const client = clients.get(engagement.clientId);
        return {
          ...task,
          clientName: client?.Name || "N/A",
          engagementRemarks: engagement.remarks,
          dueDate: new Date(engagement.dueDate),
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [tasks, engagementMap, clients]);

  const filteredTasks = React.useMemo(() => {
    return enrichedTasks.filter((task) => {
      const statusMatch =
        filter === "all" ||
        (filter === "pending" && task.status === "Pending") ||
        (filter === "completed" && task.status === "Completed");

      const termMatch =
        !searchTerm ||
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.engagementRemarks.toLowerCase().includes(searchTerm.toLowerCase());

      return statusMatch && termMatch;
    });
  }, [enrichedTasks, filter, searchTerm]);

  return (
    <Card className="h-full flex flex-col">
      <div className="p-4 flex items-center justify-between gap-4 border-b">
        <Input
          placeholder="Search tasks or clients..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tasks</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <CardContent className="p-0 flex-grow">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader className="sticky top-0 bg-muted z-10">
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Checkbox
                        checked={task.status === "Completed"}
                        onCheckedChange={(checked) =>
                          onTaskStatusChange(
                            task.id,
                            checked ? "Completed" : "Pending"
                          )
                        }
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "font-medium",
                        task.status === "Completed" &&
                          "line-through text-muted-foreground"
                      )}
                    >
                      {task.title}
                    </TableCell>
                    <TableCell>{task.clientName}</TableCell>
                    <TableCell className={cn(
                        isPast(task.dueDate) && task.status !== 'Completed' && "text-destructive font-semibold"
                    )}>
                        {format(task.dueDate, "dd MMM, yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No tasks found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
