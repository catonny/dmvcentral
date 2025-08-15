
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LearningLog, Employee } from "@/lib/data";
import { PlusCircle } from "lucide-react";
import { CreateLearningLogDialog } from "./create-learning-log-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { format } from "date-fns";

interface LearningLogListProps {
  learningLogs: LearningLog[];
  allEmployees: Employee[];
  currentUser: Employee | null;
}

export function LearningLogList({ learningLogs, allEmployees, currentUser }: LearningLogListProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const userLogs = learningLogs.filter(log => log.userId === currentUser?.id);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>My Learning Log</CardTitle>
            <CardDescription>A record of your professional development hours.</CardDescription>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <PlusCircle className="mr-2"/>
            Log Learning Hours
          </Button>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead>Topic</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {userLogs.length > 0 ? userLogs.map(log => (
                        <TableRow key={log.id}>
                            <TableCell>{format(new Date(log.date), "dd MMM, yyyy")}</TableCell>
                            <TableCell>{log.area}</TableCell>
                            <TableCell>{log.topic}</TableCell>
                            <TableCell className="text-right">{log.durationHours}</TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center h-24">No learning hours logged yet.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
      <CreateLearningLogDialog 
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        currentUser={currentUser}
      />
    </>
  );
}
