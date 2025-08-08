
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { engagementStatuses } from "../engagement-statuses";
import type { EngagementType, EngagementStatus } from "@/lib/data";
import type { FilterState } from "@/app/(app)/reports/advanced-engagement-report/page";
import { SlidersHorizontal } from "lucide-react";

interface AdvancedReportFiltersProps {
    engagementTypes: EngagementType[];
    onFiltersChange: (filters: FilterState) => void;
}

export function AdvancedReportFilters({ engagementTypes, onFiltersChange }: AdvancedReportFiltersProps) {
    const [selectedTypeId, setSelectedTypeId] = React.useState<string>("");
    const [selectedStatus, setSelectedStatus] = React.useState<EngagementStatus | "All">("All");
    const [taskFilters, setTaskFilters] = React.useState<FilterState['taskFilters']>([]);

    React.useEffect(() => {
        const selectedType = engagementTypes.find(et => et.id === selectedTypeId);
        if (selectedType) {
            setTaskFilters(selectedType.subTaskTitles.map(title => ({
                taskTitle: title,
                status: "Any",
            })));
        } else {
            setTaskFilters([]);
        }
    }, [selectedTypeId, engagementTypes]);
    
    const handleTaskFilterChange = (taskTitle: string, status: "Pending" | "Completed" | "Any") => {
        setTaskFilters(prev => prev.map(f => f.taskTitle === taskTitle ? { ...f, status } : f));
    }
    
    const handleApplyFilters = () => {
        onFiltersChange({
            engagementTypeId: selectedTypeId,
            engagementStatus: selectedStatus,
            taskFilters: taskFilters,
        });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <SlidersHorizontal />
                    Report Filters
                </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                <div className="grid gap-2">
                    <Label>1. Engagement Type</Label>
                    <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                        <SelectTrigger><SelectValue placeholder="Select an engagement type..." /></SelectTrigger>
                        <SelectContent>
                            {engagementTypes.map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="grid gap-2">
                    <Label>2. Overall Status</Label>
                    <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Statuses</SelectItem>
                            {engagementStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                {selectedTypeId && taskFilters.length > 0 && (
                     <div className="grid gap-2 md:col-span-2 lg:col-span-3">
                        <Label>3. Task Status Filters</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 border rounded-md">
                            {taskFilters.map(filter => (
                                <div key={filter.taskTitle} className="grid gap-1">
                                    <Label className="text-xs">{filter.taskTitle}</Label>
                                    <Select value={filter.status} onValueChange={(v) => handleTaskFilterChange(filter.taskTitle, v as any)}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Any">Any</SelectItem>
                                            <SelectItem value="Pending">Pending</SelectItem>
                                            <SelectItem value="Completed">Completed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                 <div className="lg:col-span-3 flex justify-end">
                    <Button onClick={handleApplyFilters} disabled={!selectedTypeId}>
                        Apply Filters
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

