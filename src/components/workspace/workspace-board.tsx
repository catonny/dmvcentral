
"use client";

import * as React from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Engagement, Employee, Department, Client, Task, CalendarEvent } from "@/lib/data";
import { DepartmentColumn } from "./department-column";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { EngagementCard } from "./engagement-card";
import { doc, updateDoc, writeBatch, collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { EventDialog } from "../calendar/event-dialog";
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
import { EngagementListItem } from "./engagement-list-item";

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
    const [isEventDialogOpen, setIsEventDialogOpen] = React.useState(false);
    const [eventDialogInfo, setEventDialogInfo] = React.useState<any>(null);
    
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

    const visibleDepartments = React.useMemo(() => {
        const userRoles = currentUser.role;
        let deptsToShow: Department[];

        if (userRoles.includes("Admin")) {
            deptsToShow = allDepartments.filter(dept => allEmployees.some(emp => emp.role.includes(dept.name)));
        } else {
            const userDeptOrders = userRoles
                .map(role => allDepartments.find(d => d.name === role)?.order)
                .filter((order): order is number => order !== undefined);
            
            if (userDeptOrders.length === 0) {
                deptsToShow = [];
            } else {
                const minOrder = Math.min(...userDeptOrders);
                const depts = allDepartments.filter(dept => dept.order >= minOrder);
                const uniqueDeptMap = new Map(depts.map(d => [d.id, d]));
                deptsToShow = Array.from(uniqueDeptMap.values()).filter(dept => allEmployees.some(emp => emp.role.includes(dept.name)));
            }
        }
        
        // Always filter out the 'Admin' department from being displayed as a column
        return deptsToShow.filter(dept => dept.name !== 'Admin');
        
    }, [currentUser, allDepartments, allEmployees]);

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

    const handleOpenScheduleDialog = (engagement: Engagement) => {
        const now = new Date();
        setEventDialogInfo({
            title: `Meeting: ${engagement.remarks}`,
            startStr: now.toISOString(),
            endStr: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
            allDay: false,
            attendees: engagement.assignedTo,
            engagementId: engagement.id,
        });
        setIsEventDialogOpen(true);
    };

    const handleSaveEvent = async (eventData: Partial<CalendarEvent>) => {
        if (!currentUser) {
            toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
            return;
        }
        try {
            if (eventData.id) {
                // Not supporting edits from here for now
            } else {
                await addDoc(collection(db, "events"), {
                    ...eventData,
                    createdBy: currentUser.id,
                });
                toast({ title: "Success", description: "Meeting scheduled on the team calendar." });
            }
            setIsEventDialogOpen(false);
        } catch (error) {
            console.error("Error saving event:", error);
            toast({ title: "Error", description: "Failed to schedule meeting.", variant: "destructive" });
        }
    };
    
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
                    {visibleDepartments
                        .map(dept => (
                        <DepartmentColumn
                            key={dept.id}
                            department={dept}
                            employees={allEmployees.filter(emp => emp.role.includes(dept.name))}
                            engagements={allEngagements}
                            clientMap={clientMap}
                            employeeMap={employeeMap}
                            onRemoveUser={handleRemoveUser}
                            onScheduleMeeting={handleOpenScheduleDialog}
                        />
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
             <DragOverlay>
                {activeEngagement ? (
                    <EngagementListItem
                        engagement={activeEngagement}
                        client={clientMap.get(activeEngagement.clientId)}
                    />
                ) : null}
            </DragOverlay>
            <EventDialog
                isOpen={isEventDialogOpen}
                onClose={() => setIsEventDialogOpen(false)}
                onSave={handleSaveEvent}
                onDelete={() => {}} // Not implemented from here
                eventInfo={eventDialogInfo}
                employees={allEmployees}
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
