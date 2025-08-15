
"use client"

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Employee } from "@/lib/data";
import { ScrollArea } from "../ui/scroll-area";

interface BudgetHoursDialogProps {
  isOpen: boolean;
  onClose: () => void;
  team: Employee[];
  initialBudgets: { employeeId: string; hours: number }[];
  onSave: (budgets: { employeeId: string; hours: number }[]) => void;
}

export function BudgetHoursDialog({ isOpen, onClose, team, initialBudgets, onSave }: BudgetHoursDialogProps) {
  const [budgets, setBudgets] = React.useState<Map<string, number>>(new Map());

  React.useEffect(() => {
    if (isOpen) {
      const initialMap = new Map<string, number>();
      initialBudgets.forEach(b => initialMap.set(b.employeeId, b.hours));
      team.forEach(t => {
        if (!initialMap.has(t.id)) {
            initialMap.set(t.id, 0);
        }
      });
      setBudgets(initialMap);
    }
  }, [isOpen, team, initialBudgets]);

  const handleHourChange = (employeeId: string, hours: string) => {
    const newBudgets = new Map(budgets);
    newBudgets.set(employeeId, Number(hours) || 0);
    setBudgets(newBudgets);
  };
  
  const handleSave = () => {
    const budgetArray = Array.from(budgets.entries()).map(([employeeId, hours]) => ({ employeeId, hours }));
    onSave(budgetArray);
    onClose();
  };
  
  const totalHours = Array.from(budgets.values()).reduce((sum, hours) => sum + hours, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Set Budgeted Hours</DialogTitle>
          <DialogDescription>
            Allocate specific hours for each team member for this engagement.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <ScrollArea className="h-72 w-full rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Team Member</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Charge-Out Rate (/hr)</TableHead>
                            <TableHead className="w-[120px]">Budgeted Hours</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {team.map(member => (
                            <TableRow key={member.id}>
                                <TableCell className="font-medium">{member.name}</TableCell>
                                <TableCell>{member.role.join(", ")}</TableCell>
                                <TableCell>₹{member.chargeOutRate?.toLocaleString() || 'N/A'}</TableCell>
                                <TableCell>
                                    <Input
                                        type="number"
                                        value={budgets.get(member.id) || ""}
                                        onChange={(e) => handleHourChange(member.id, e.target.value)}
                                        placeholder="0"
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
             <div className="flex justify-end mt-4 font-semibold">
                Total Budgeted Hours: {totalHours}
            </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSave}>
            Accept & Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
