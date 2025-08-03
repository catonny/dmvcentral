

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Client, Engagement, EngagementStatus } from "@/lib/data";
import { CheckCircle, CircleDashed, FileClock, Users, CircleX, FileCheck2, AlertCircle, ChevronDown, ChevronUp, UserX, Briefcase, FileQuestion, UserCheck } from "lucide-react";
import * as React from 'react';
import { Button } from "../ui/button";

interface StatusCardsProps {
    clients: Client[];
    engagements: Engagement[];
    isPartner: boolean;
}

const statusIcons: { [key in EngagementStatus | 'Unassigned']: React.ReactNode } = {
    "Pending": <FileClock className="h-4 w-4 text-muted-foreground" />,
    "Awaiting Documents": <FileQuestion className="h-4 w-4 text-yellow-500" />,
    "In Process": <CircleDashed className="h-4 w-4 text-blue-500 animate-spin" />,
    "Partner Review": <UserCheck className="h-4 w-4 text-purple-500" />,
    "Completed": <CheckCircle className="h-4 w-4 text-green-500" />,
    "Cancelled": <CircleX className="h-4 w-4 text-red-500" />,
    "Unassigned": <UserX className="h-4 w-4 text-red-500" />,
};

const statusDescriptions: { [key in EngagementStatus | 'Unassigned']: string } = {
    "Pending": "Engagements waiting to be started",
    "Awaiting Documents": "Waiting for documents from the client",
    "In Process": "Engagements currently being worked on",
    "Partner Review": "Engagements awaiting review by a partner",
    "Completed": "Successfully finished engagements",
    "Cancelled": "Client engagements that were cancelled",
    "Unassigned": "Tasks not assigned to anyone",
};

const defaultStatuses: EngagementStatus[] = ["Pending", "In Process", "Completed"];


export function StatusCards({ clients, engagements, isPartner }: StatusCardsProps) {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const { statusCounts, unassignedCount } = React.useMemo(() => {
        const counts: { [key in EngagementStatus]?: number } = {};
        let unassigned = 0;
        
        for (const engagement of engagements) {
            if (!engagement.assignedTo || engagement.assignedTo === "") {
                unassigned++;
            }
            if (engagement.status) {
                 if (!counts[engagement.status]) {
                    counts[engagement.status] = 0;
                }
                counts[engagement.status]!++;
            }
        }
        return { statusCounts: counts, unassignedCount: unassigned };
    }, [engagements]);

    const allActiveStatuses = (Object.keys(statusCounts) as EngagementStatus[]).filter(status => (statusCounts[status] ?? 0) > 0);
    const displayedStatuses = isExpanded ? allActiveStatuses : defaultStatuses.filter(s => allActiveStatuses.includes(s));


    const partnerCards = (
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unassigned Engagements</CardTitle>
                {statusIcons["Unassigned"]}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{unassignedCount}</div>
                <p className="text-xs text-muted-foreground">
                    {statusDescriptions["Unassigned"]}
                </p>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{isPartner ? 'Total Clients' : 'Assigned Clients'}</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{clients.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {isPartner ? 'Total clients in your firm' : 'Clients assigned to you'}
                        </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{isPartner ? 'Total Engagements' : 'My Engagements'}</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{engagements.length}</div>
                        <p className="text-xs text-muted-foreground">
                             {isPartner ? 'Total engagements across all clients' : 'Total engagements assigned to you'}
                        </p>
                    </CardContent>
                </Card>
                {isPartner && partnerCards}
                {displayedStatuses.map(status => (
                    <Card key={status}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{status}</CardTitle>
                            {statusIcons[status]}
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{statusCounts[status] || 0}</div>
                            <p className="text-xs text-muted-foreground">
                                {statusDescriptions[status]}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>
             {allActiveStatuses.length > defaultStatuses.length && (
                <div className="flex justify-center">
                    <Button variant="outline" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
                        {isExpanded ? (
                            <>
                                <ChevronUp className="mr-2 h-4 w-4" />
                                Show Less
                            </>
                        ) : (
                            <>
                            <ChevronDown className="mr-2 h-4 w-4" />
                                Show All Statuses
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
}
