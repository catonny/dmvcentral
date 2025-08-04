
"use client";

import * as React from "react";
import { Employee, Department, Engagement, Client } from "@/lib/data";
import { EmployeeLane } from "./employee-lane";

interface DepartmentColumnProps {
    department: Department;
    employees: Employee[];
    engagements: Engagement[];
    clientMap: Map<string, Client>;
    employeeMap: Map<string, Employee>;
    onRemoveUser: (engagementId: string, userIdToRemove: string) => void;
    onLogTime: (engagement: Engagement) => void;
}

export function DepartmentColumn({ department, employees, engagements, clientMap, employeeMap, onRemoveUser, onLogTime }: DepartmentColumnProps) {
    // Sort employees within the department, if needed
    const sortedEmployees = employees.sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="flex-shrink-0 w-[--department-width]" style={{'--department-width': 'calc(100vw - 8rem)'} as React.CSSProperties}>
            <div className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 py-2">
                <h2 className="text-xl font-bold font-headline tracking-tight text-foreground">{department.name}</h2>
                <p className="text-sm text-muted-foreground">{employees.length} team member(s)</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                {sortedEmployees.map(employee => (
                    <EmployeeLane
                        key={employee.id}
                        employee={employee}
                        engagements={engagements.filter(e => e.assignedTo.includes(employee.id))}
                        clientMap={clientMap}
                        employeeMap={employeeMap}
                        onRemoveUser={onRemoveUser}
                        onLogTime={onLogTime}
                    />
                ))}
            </div>
        </div>
    );
}
