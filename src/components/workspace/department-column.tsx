
"use client";

import * as React from "react";
import { Employee, Department, Engagement, Client, EngagementType } from "@/lib/data";
import { EmployeeLane } from "./employee-lane";

interface DepartmentColumnProps {
    department: Department;
    employees: Employee[];
    engagements: Engagement[];
    engagementTypes: EngagementType[];
    clientMap: Map<string, Client>;
    onScheduleMeeting: (engagement: Engagement) => void;
}

export function DepartmentColumn({ department, employees, engagements, engagementTypes, clientMap, onScheduleMeeting }: DepartmentColumnProps) {
    const sortedEmployees = employees.sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="flex-shrink-0 w-[350px]">
            <div className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 py-2">
                <h2 className="text-xl font-bold font-headline tracking-tight text-foreground">{department.name}</h2>
                <p className="text-sm text-muted-foreground">{employees.length} team member(s)</p>
            </div>
            <div className="flex flex-col gap-4 mt-4">
                {sortedEmployees.map(employee => (
                    <EmployeeLane
                        key={employee.id}
                        employee={employee}
                        engagements={engagements.filter(e => e.assignedTo.includes(employee.id))}
                        engagementTypes={engagementTypes}
                        clientMap={clientMap}
                        onScheduleMeeting={onScheduleMeeting}
                    />
                ))}
            </div>
        </div>
    );
}
