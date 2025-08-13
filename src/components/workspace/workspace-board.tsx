
"use client";

import * as React from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor, closestCenter, Active } from "@dnd-kit/core";
import { arrayMove, SortableContext } from "@dnd-kit/sortable";
import { doc, updateDoc, writeBatch, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Task, Client, Employee, TaskStatus, Engagement, Department, EngagementType } from "@/lib/data";
import { DepartmentColumn } from "./department-column";
import { EngagementCard } from "./engagement-card";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { ScheduleMeetingDialog } from "./schedule-meeting-dialog";
import { EngagementListItem } from "./engagement-list-item";

interface WorkspaceBoardProps {
    allEngagements: Engagement[];
    allEmployees: Employee[];
    allDepartments: Department[];
    engagementTypes: EngagementType[];
    clientMap: Map<string, Client>;
    currentUser: Employee | null;
}

export function WorkspaceBoard({ allEngagements, allEmployees, allDepartments, engagementTypes, clientMap, currentUser }: WorkspaceBoardProps) {
  const { toast } = useToast();
  const [engagements, setEngagements] = React.useState(allEngagements);
  const [activeEngagement, setActiveEngagement] = React.useState<Engagement | null>(null);
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = React.useState(false);
  const [selectedEngagementForMeeting, setSelectedEngagementForMeeting] = React.useState<Engagement | null>(null);

  React.useEffect(() => {
    setEngagements(allEngagements);
  }, [allEngagements]);

  const employeeMap = React.useMemo(() => new Map(allEmployees.map(e => [e.id, e])), [allEmployees]);
  
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const engagement = engagements.find(e => e.id === active.id);
    if (engagement) {
        setActiveEngagement(engagement);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveEngagement(null);

    if (!over || active.id === over.id) return;
    
    const engagementId = active.id as string;
    const newAssigneeId = over.id as string;
    
    // Find the original engagement to get its current assignees
    const originalEngagement = allEngagements.find(e => e.id === engagementId);
    if (!originalEngagement) return;

    const oldAssignees = originalEngagement.assignedTo;
    
    // Prevent dropping on an employee who is already assigned
    if (oldAssignees.includes(newAssigneeId)) return;

    const newAssignees = [...oldAssignees, newAssigneeId];
    
    // Optimistic update
    setEngagements(prev => prev.map(e => e.id === engagementId ? { ...e, assignedTo: newAssignees } : e));

    try {
        const engagementRef = doc(db, "engagements", engagementId);
        await updateDoc(engagementRef, { assignedTo: newAssignees });
        toast({
          title: "Engagement Reassigned",
          description: `Successfully assigned to ${employeeMap.get(newAssigneeId)?.name}.`,
        });
    } catch (error) {
        setEngagements(allEngagements); // Revert on failure
        toast({ title: "Error", description: "Failed to reassign engagement.", variant: "destructive" });
    }
  };
  
  const handleRemoveUser = async (engagementId: string, userIdToRemove: string) => {
    const engagement = engagements.find(e => e.id === engagementId);
    if (!engagement) return;
    
    const newAssignees = engagement.assignedTo.filter(id => id !== userIdToRemove);
    setEngagements(prev => prev.map(e => e.id === engagementId ? { ...e, assignedTo: newAssignees } : e));

     try {
        const engagementRef = doc(db, "engagements", engagementId);
        await updateDoc(engagementRef, { assignedTo: newAssignees });
        toast({
          title: "Assignee Removed",
          description: `${employeeMap.get(userIdToRemove)?.name} has been removed from the engagement.`,
        });
    } catch (error) {
        setEngagements(allEngagements); // Revert on failure
        toast({ title: "Error", description: "Failed to remove assignee.", variant: "destructive" });
    }
  };

  const handleScheduleMeeting = (engagement: Engagement) => {
    setSelectedEngagementForMeeting(engagement);
    setIsMeetingDialogOpen(true);
  }

  const unassignedEngagements = engagements.filter(e => !e.assignedTo || e.assignedTo.length === 0);

  return (
    <>
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex h-full flex-grow overflow-hidden">
                <ScrollArea className="w-full h-full">
                    <div className="flex h-full gap-4 pb-4">
                        {(unassignedEngagements.length > 0) && (
                            <DepartmentColumn 
                                department={{ id: 'unassigned', name: 'Unassigned', order: 0 }}
                                employees={[]}
                                engagements={unassignedEngagements}
                                engagementTypes={engagementTypes}
                                clientMap={clientMap}
                                onScheduleMeeting={handleScheduleMeeting}
                            />
                        )}

                        {allDepartments
                          .filter(dept => dept.name !== 'Admin')
                          .map(dept => {
                            const departmentEmployees = allEmployees.filter(emp => emp.role.includes(dept.name));
                            const departmentEmployeeIds = new Set(departmentEmployees.map(e => e.id));
                            const departmentEngagements = engagements.filter(e => e.assignedTo.some(id => departmentEmployeeIds.has(id)));
                            
                            if(departmentEmployees.length === 0 && departmentEngagements.length === 0) {
                                return null;
                            }

                            return (
                                <DepartmentColumn
                                    key={dept.id}
                                    department={dept}
                                    employees={departmentEmployees}
                                    engagements={engagements}
                                    engagementTypes={engagementTypes}
                                    clientMap={clientMap}
                                    onScheduleMeeting={handleScheduleMeeting}
                                />
                            )
                        })}
                    </div>
                     <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
            <DragOverlay>
              {activeEngagement ? (
                <EngagementCard
                    engagement={activeEngagement}
                    client={clientMap.get(activeEngagement.clientId)}
                    employeeMap={employeeMap}
                    onRemoveUser={() => {}}
                    onScheduleMeeting={() => {}}
                />
              ) : null}
            </DragOverlay>
        </DndContext>
        <ScheduleMeetingDialog
            isOpen={isMeetingDialogOpen}
            onClose={() => setIsMeetingDialogOpen(false)}
            engagement={selectedEngagementForMeeting}
            employees={allEmployees}
            currentUser={currentUser}
        />
    </>
  );
}
