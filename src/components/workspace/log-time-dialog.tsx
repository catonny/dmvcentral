
"use client";

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
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Engagement, Employee, Timesheet, TimesheetEntry } from "@/lib/data";
import { startOfWeek, format } from 'date-fns';
import { Loader2 } from "lucide-react";

interface LogTimeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  engagement: Engagement | null;
  currentUser: Employee | null;
}

export function LogTimeDialog({ isOpen, onClose, engagement, currentUser }: LogTimeDialogProps) {
    const { toast } = useToast();
    const [hours, setHours] = React.useState<number | string>("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [currentWeekHours, setCurrentWeekHours] = React.useState(0);

    const getWeekStartDate = () => {
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
        return format(weekStart, 'yyyy-MM-dd');
    };
    
    React.useEffect(() => {
        if (!isOpen || !currentUser) return;
        
        const fetchCurrentHours = async () => {
             const weekStartDate = getWeekStartDate();
             const timesheetId = `${currentUser.id}_${weekStartDate}`;
             const timesheetRef = doc(db, "timesheets", timesheetId);
             const timesheetSnap = await getDoc(timesheetRef);

             if (timesheetSnap.exists()) {
                 const data = timesheetSnap.data() as Timesheet;
                 setCurrentWeekHours(data.totalHours);
                 const entry = data.entries.find(e => e.engagementId === engagement?.id);
                 setHours(entry?.hours || "");
             } else {
                 setCurrentWeekHours(0);
                 setHours("");
             }
        }
        
        fetchCurrentHours();

    }, [isOpen, currentUser, engagement]);

    const handleSave = async () => {
        if (!engagement || !currentUser) return;

        const loggedHours = Number(hours);
        if (isNaN(loggedHours) || loggedHours <= 0) {
            toast({ title: "Invalid Input", description: "Please enter a valid number of hours.", variant: "destructive" });
            return;
        }

        setIsLoading(true);

        const weekStartDate = getWeekStartDate();
        const timesheetId = `${currentUser.id}_${weekStartDate}`;
        const timesheetRef = doc(db, "timesheets", timesheetId);

        try {
            const timesheetSnap = await getDoc(timesheetRef);

            if (timesheetSnap.exists()) {
                // Update existing timesheet
                const existingData = timesheetSnap.data() as Timesheet;
                const otherEntries = existingData.entries.filter(e => e.engagementId !== engagement.id);
                const newTotalHours = otherEntries.reduce((sum, e) => sum + e.hours, 0) + loggedHours;
                
                const newEntries: TimesheetEntry[] = [...otherEntries, { engagementId: engagement.id, hours: loggedHours }];
                
                await updateDoc(timesheetRef, {
                    entries: newEntries,
                    totalHours: newTotalHours
                });

            } else {
                // Create new timesheet
                const newTimesheet: Timesheet = {
                    id: timesheetId,
                    userId: currentUser.id,
                    userName: currentUser.name,
                    isPartner: currentUser.role.includes("Partner"),
                    weekStartDate: new Date(weekStartDate).toISOString(),
                    totalHours: loggedHours,
                    entries: [{ engagementId: engagement.id, hours: loggedHours }],
                };
                await setDoc(timesheetRef, newTimesheet);
            }
            toast({ title: "Success", description: "Time logged successfully." });
            onClose();
        } catch (error) {
            console.error("Error saving timesheet:", error);
            toast({ title: "Error", description: "Failed to save time.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDialogClose = () => {
        setHours("");
        onClose();
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Log Time for Engagement</DialogTitle>
                    <DialogDescription>
                        Enter the hours you've worked on <span className="font-semibold">{engagement?.remarks}</span> for the week starting <span className="font-semibold">{format(new Date(getWeekStartDate()), 'MMM dd, yyyy')}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="hours" className="text-right">
                            Hours
                        </Label>
                        <Input
                            id="hours"
                            type="number"
                            value={hours}
                            onChange={(e) => setHours(e.target.value)}
                            className="col-span-3"
                            placeholder="e.g., 2.5"
                        />
                    </div>
                     <div className="text-sm text-center text-muted-foreground">
                        Total hours logged this week: <span className="font-bold">{currentWeekHours.toFixed(1)}</span>
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleDialogClose}>
                        Cancel
                    </Button>
                    <Button type="submit" onClick={handleSave} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
