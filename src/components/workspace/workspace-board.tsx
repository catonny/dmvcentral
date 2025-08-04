
"use client";

import * as React from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Engagement, Employee, Department, Client } from "@/lib/data";
import { DepartmentColumn } from "./department-column";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { EngagementCard } from "./engagement-card";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

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
        
        // Optimistic update can be done here by calling a state setter function from the parent
        // For now, we directly update Firestore
        
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
            // Here you would revert the optimistic update
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
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
