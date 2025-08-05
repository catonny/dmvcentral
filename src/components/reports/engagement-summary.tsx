
"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportsEngagement } from "@/app/(app)/reports/page";
import type { EngagementStatus, EngagementType } from "@/lib/data";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";

interface EngagementSummaryTableProps {
    engagements: ReportsEngagement[];
    engagementTypes: EngagementType[];
}

interface SummaryData {
    [engagementTypeName: string]: {
        Pending: number;
        "In Process": number;
        "Partner Review": number;
    };
}

export function EngagementSummaryTable({ engagements, engagementTypes }: EngagementSummaryTableProps) {

    const summaryData: SummaryData = React.useMemo(() => {
        const data: SummaryData = {};

        // Initialize with all engagement types
        for (const type of engagementTypes) {
            data[type.name] = {
                Pending: 0,
                "In Process": 0,
                "Partner Review": 0,
            };
        }

        for (const engagement of engagements) {
            if (engagement.engagementTypeName && data[engagement.engagementTypeName]) {
                const status = engagement.status as EngagementStatus;
                if (status === "Pending" || status === "In Process" || status === "Partner Review") {
                    data[engagement.engagementTypeName][status]++;
                }
            }
        }
        
        // Filter out engagement types that have no engagements in the specified statuses
        const filteredData = Object.entries(data)
            .filter(([, counts]) => counts.Pending > 0 || counts["In Process"] > 0 || counts["Partner Review"] > 0)
            .reduce((acc, [key, value]) => {
                acc[key] = value;
                return acc;
            }, {} as SummaryData);

        return filteredData;
    }, [engagements, engagementTypes]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Engagement Summary</CardTitle>
                <CardDescription>
                    A high-level view of active engagements by status.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="w-full whitespace-nowrap">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Engagement Category</TableHead>
                                <TableHead className="text-center">Pending</TableHead>
                                <TableHead className="text-center">In Process</TableHead>
                                <TableHead className="text-center">Partner Review</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.keys(summaryData).length > 0 ? (
                                Object.entries(summaryData).map(([typeName, counts]) => (
                                    <TableRow key={typeName}>
                                        <TableCell className="font-medium">{typeName}</TableCell>
                                        <TableCell className="text-center">{counts.Pending}</TableCell>
                                        <TableCell className="text-center">{counts["In Process"]}</TableCell>
                                        <TableCell className="text-center">{counts["Partner Review"]}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No active engagements found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                    <ScrollBar orientation="vertical" />
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
