

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Client, Engagement, Task, Timesheet } from "@/lib/data";
import { Users, Briefcase, UserX, ListTodo, AlertTriangle, GanttChartSquare, Timer } from "lucide-react";
import * as React from 'react';
import { isThisWeek, parseISO, startOfWeek, format } from 'date-fns';

interface StatusCardProps {
    title: string;
    value: number | string;
    description: string;
    icon: React.ElementType;
}

const KpiCard = ({ title, value, description, icon: Icon }: StatusCardProps) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);


interface StatusCardsProps {
    data: {
        clients: Client[];
        engagements: Engagement[];
        tasks: Task[];
        timesheets: Timesheet[];
    } | null;
    userRole: "Admin" | "Partner" | "Employee";
}

export function StatusCards({ data, userRole }: StatusCardsProps) {
    const kpiData = React.useMemo(() => {
        if (!data) return [];
        
        const { clients, engagements, tasks, timesheets } = data;
        
        if (userRole === 'Admin') {
            return [
                { title: 'Total Clients', value: clients.length, description: 'Total clients across the firm.', icon: Users },
                { title: 'Total Engagements', value: engagements.length, description: 'All active engagements in the firm.', icon: Briefcase },
                { title: 'Unassigned Engagements', value: engagements.filter(e => !e.assignedTo || e.assignedTo.length === 0).length, description: 'Engagements not assigned to any team member.', icon: UserX },
            ];
        }

        if (userRole === 'Partner') {
             const unassignedEngagements = engagements.filter(e => !e.assignedTo || e.assignedTo.length === 0);
            return [
                { title: 'My Active Clients', value: clients.length, description: 'Clients for whom you are the partner.', icon: Users },
                { title: 'Total Engagements', value: engagements.length, description: 'Active engagements for your clients.', icon: Briefcase },
                { title: 'Unassigned Engagements', value: unassignedEngagements.length, description: 'Engagements for your clients needing assignment.', icon: UserX },
            ];
        }
        
        // Employee View
        const pendingTasks = tasks.filter(t => t.status === 'Pending');
        const pendingThisWeek = pendingTasks.filter(t => {
            const engagement = engagements.find(e => e.id === t.engagementId);
            return engagement && isThisWeek(parseISO(engagement.dueDate), { weekStartsOn: 1 });
        });

        const weekStartDate = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const currentWeekTimesheet = timesheets.find(ts => ts.weekStartDate.startsWith(weekStartDate));
        const hoursLoggedThisWeek = currentWeekTimesheet?.totalHours || 0;

        return [
            { title: 'My Active Engagements', value: engagements.length, description: 'Your current active workload.', icon: GanttChartSquare },
            { title: 'Pending Tasks This Week', value: pendingThisWeek.length, description: 'Tasks with a due date this week.', icon: AlertTriangle },
            { title: 'All Pending Tasks', value: pendingTasks.length, description: 'Your total number of pending tasks.', icon: ListTodo },
            { title: 'Hours Logged This Week', value: hoursLoggedThisWeek.toFixed(1), description: 'Your total time logged this week.', icon: Timer },
        ];
        
    }, [data, userRole]);

    if (userRole === "Admin" || userRole === "Partner") {
        return (
            <div className="grid gap-4 md:grid-cols-3">
                {kpiData.map(item => <KpiCard key={item.title} {...item} />)}
            </div>
        );
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {kpiData.map(item => <KpiCard key={item.title} {...item} />)}
        </div>
    );
}
