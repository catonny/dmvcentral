"use client";

import * as React from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Engagement, Employee, Department, Client, Task } from "@/lib/data";
import { DepartmentColumn } from "./department-column";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { EngagementCard } from "./engagement-card";
import { doc, updateDoc, writeBatch, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { LogTimeDialog } from "./log-time-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

interface WorkspaceBoardProps {
    allEngagements: Engagement[];
    allEmployees: Employee[];
    allDepartments: Department[];
    clientMap: Map<string, Client>;
    currentUser: Employee;
}

export function WorkspaceBoard({ allEngagements, allEmployees, allDepartments, clientMap, currentUser }: WorkspaceBoardProps) {
    const { toast } = useToast();
    const [activeEngagement, setActiveEngagement] = React.useState<Engagement | null>(null);
    const [isLogTimeDialogOpen, setIsLogTimeDialogOpen] = React.useState(false);
    const [engagementToLog, setEngagementToLog] = React.useState<Engagement | null>(null);
    
    const [isPromptOpen, setIsPromptOpen] = React.useState(false);
    const activityTimer = React.useRef<NodeJS.Timeout | null>(null);

    const resetActivityTimer = React.useCallback(() => {
        if (activityTimer.current) {
            clearTimeout(activityTimer.current);
        }
        activityTimer.current = setTimeout(() => {
            setIsPromptOpen(true);
        }, ACTIVITY_TIMEOUT);
    }, []);

    React.useEffect(() => {
        resetActivityTimer();
        window.addEventListener('mousemove', resetActivityTimer);
        window.addEventListener('keydown', resetActivityTimer);
        window.addEventListener('click', resetActivityTimer);

        return () => {
            if (activityTimer.current) {
                clearTimeout(activityTimer.current);
            }
            window.removeEventListener('mousemove', resetActivityTimer);
            window.removeEventListener('keydown', resetActivityTimer);
            window.removeEventListener('click', resetActivityTimer);
        };
    }, [resetActivityTimer]);

    // Determine which departments the current user can see
    const visibleDepartments = React.useMemo(() => {
        const userRoles = currentUser.role;
        if (userRoles.includes("Admin")) {
            return allDepartments;
        }

        const userDeptOrders = userRoles.map(role => {
            const dept = allDepartments.find(d => d.name === role);
            return dept ? dept.order : Infinity;
        });
        
        const minOrder = Math.min(...userDeptOrders);

        return allDepartments.filter(dept => dept.order >= minOrder);
    }, [currentUser, allDepartments]);

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const engagement = allEngagements.find(e => e.id === active.id);
        if (engagement) {
            setActiveEngagement(engagement);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveEngagement(null);
        const { active, over } = event;

        if (!over || !active) return;
        
        const engagementId = active.id as string;
        const targetEmployeeId = over.id as string;

        const engagement = allEngagements.find(e => e.id === engagementId);
        if (!engagement) return;

        // If dropping on the same user or if the user is already assigned, do nothing
        if (engagement.assignedTo.includes(targetEmployeeId)) return;
        
        const newAssignedTo = [...engagement.assignedTo, targetEmployeeId];
        
        try {
            const engagementRef = doc(db, "engagements", engagementId);
            await updateDoc(engagementRef, { assignedTo: newAssignedTo });
            const targetEmployee = allEmployees.find(e => e.id === targetEmployeeId);
            toast({
                title: "Engagement Updated",
                description: `${targetEmployee?.name} has been added to the engagement "${engagement.remarks}".`
            });
        } catch (error) {
            console.error("Error updating engagement assignment:", error);
            toast({
                title: "Update Failed",
                description: "Could not reassign the engagement.",
                variant: "destructive",
            });
        }
    };
    
     const handleRemoveUser = async (engagementId: string, userIdToRemove: string) => {
        const engagement = allEngagements.find(e => e.id === engagementId);
        if (!engagement) return;

        const newAssignedTo = engagement.assignedTo.filter(id => id !== userIdToRemove);
        
        if (newAssignedTo.length === 0) {
            toast({
                title: "Action prevented",
                description: "Cannot remove the last user from an engagement. Add another user first.",
                variant: "destructive"
            });
            return;
        }

        try {
            const engagementRef = doc(db, "engagements", engagementId);
            await updateDoc(engagementRef, { assignedTo: newAssignedTo });
             const removedEmployee = allEmployees.find(e => e.id === userIdToRemove);
            toast({
                title: "User Removed",
                description: `${removedEmployee?.name} has been removed from the engagement.`
            });
        } catch (error) {
            console.error("Error removing user from engagement:", error);
            toast({
                title: "Update Failed",
                description: "Could not remove the user.",
                variant: "destructive",
            });
        }
    };

    const handleOpenLogTimeDialog = (engagement: Engagement) => {
        setEngagementToLog(engagement);
        setIsLogTimeDialogOpen(true);
    }
    
    const handleClosePrompt = () => {
        setIsPromptOpen(false);
        resetActivityTimer();
    }

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );
    
    const employeeMap = new Map(allEmployees.map(e => [e.id, e]));

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} sensors={sensors}>
            <ScrollArea className="flex-grow w-full">
                <div className="flex gap-6 pb-4">
                    {visibleDepartments.map(dept => (
                        <DepartmentColumn
                            key={dept.id}
                            department={dept}
                            employees={allEmployees.filter(emp => emp.role.includes(dept.name))}
                            engagements={allEngagements}
                            clientMap={clientMap}
                            employeeMap={employeeMap}
                            onRemoveUser={handleRemoveUser}
                            onLogTime={handleOpenLogTimeDialog}
                        />
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
             <DragOverlay>
                {activeEngagement ? (
                    <EngagementCard 
                        engagement={activeEngagement} 
                        client={clientMap.get(activeEngagement.clientId)}
                        employeeMap={employeeMap}
                        onRemoveUser={() => {}} // No action during drag
                        onLogTime={() => {}}
                    />
                ) : null}
            </DragOverlay>
            <LogTimeDialog
                isOpen={isLogTimeDialogOpen}
                onClose={() => setIsLogTimeDialogOpen(false)}
                engagement={engagementToLog}
                currentUser={currentUser}
            />
            <AlertDialog open={isPromptOpen} onOpenChange={setIsPromptOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Don't Forget to Log Your Time!</AlertDialogTitle>
                        <AlertDialogDescription>
                            It looks like you've been working for a while. Remember to log your hours to ensure accurate reporting.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={handleClosePrompt}>OK, I'll Remember</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DndContext>
    );
}
