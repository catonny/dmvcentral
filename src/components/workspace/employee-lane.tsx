
"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Employee, Engagement, Client, EngagementType } from "@/lib/data";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { cn } from "@/lib/utils";
import { EngagementListItem } from "./engagement-list-item";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { Badge } from "../ui/badge";
import { LogTimeDialog } from "./log-time-dialog";
import { useAuth } from "@/hooks/use-auth";

interface EmployeeLaneProps {
    employee: Employee;
    engagements: Engagement[];
    engagementTypes: EngagementType[];
    clientMap: Map<string, Client>;
    onScheduleMeeting: (engagement: Engagement) => void;
}

interface GroupedEngagements {
    [typeId: string]: Engagement[];
}

export function EmployeeLane({ employee, engagements, engagementTypes, clientMap, onScheduleMeeting }: EmployeeLaneProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: employee.id,
    });
    const { user } = useAuth();
    const [openCollapsibleId, setOpenCollapsibleId] = React.useState<string | null>(null);
    const [isLogTimeOpen, setIsLogTimeOpen] = React.useState(false);
    const [selectedEngagementForLog, setSelectedEngagementForLog] = React.useState<Engagement | null>(null);

    const groupedEngagements = React.useMemo(() => {
        return engagements.reduce((acc, eng) => {
            const typeId = eng.type;
            if (!acc[typeId]) {
                acc[typeId] = [];
            }
            acc[typeId].push(eng);
            return acc;
        }, {} as GroupedEngagements);
    }, [engagements]);

    const engagementTypeMap = React.useMemo(() => new Map(engagementTypes.map(et => [et.id, et.name])), [engagementTypes]);
    
    const handleOpenLogTime = (engagement: Engagement) => {
        setSelectedEngagementForLog(engagement);
        setIsLogTimeOpen(true);
    };


    return (
        <>
        <div 
            ref={setNodeRef}
            className={cn(
                "flex flex-col gap-3 p-3 rounded-lg bg-muted/30 transition-colors h-full",
                isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}
        >
             <div className="flex items-center gap-3 flex-shrink-0 cursor-pointer group">
                <Avatar>
                    <AvatarImage src={employee.avatar} alt={employee.name} />
                    <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-grow">
                    <h3 className="font-semibold text-foreground">{employee.name}</h3>
                    <p className="text-xs text-muted-foreground">{engagements.length} active engagement(s)</p>
                </div>
            </div>

            <div className="space-y-1">
                 {Object.entries(groupedEngagements).map(([typeId, engagementList]) => (
                     <Collapsible key={typeId} onOpenChange={(isOpen) => setOpenCollapsibleId(isOpen ? typeId : null)} open={openCollapsibleId === typeId}>
                        <CollapsibleTrigger className="w-full">
                             <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted w-full text-left">
                                <div className="flex items-center gap-2">
                                     <ChevronRight className={cn("h-4 w-4 transition-transform", openCollapsibleId === typeId && "rotate-90")} />
                                    <span className="text-sm font-medium">{engagementTypeMap.get(typeId) || "Untitled Type"}</span>
                                </div>
                                <Badge variant="secondary">{engagementList.length}</Badge>
                            </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="space-y-2 min-h-[10px] flex-grow pt-2 pl-4">
                                <SortableContext items={engagementList.map(e => e.id)} strategy={verticalListSortingStrategy}>
                                    {engagementList.map(engagement => (
                                        <EngagementListItem
                                            key={engagement.id}
                                            engagement={engagement}
                                            client={clientMap.get(engagement.clientId)}
                                            onLogTime={handleOpenLogTime}
                                        />
                                    ))}
                                </SortableContext>
                            </div>
                        </CollapsibleContent>
                     </Collapsible>
                 ))}
            </div>
        </div>
        <LogTimeDialog
            isOpen={isLogTimeOpen}
            onClose={() => setIsLogTimeOpen(false)}
            engagement={selectedEngagementForLog}
            currentUser={employee}
        />
        </>
    );
}
