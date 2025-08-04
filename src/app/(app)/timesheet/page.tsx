
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TimesheetPage() {
  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
                <h2 className="text-3xl font-bold tracking-tight font-headline">Timesheets</h2>
                <p className="text-muted-foreground">
                    View and manage weekly timesheets for your team.
                </p>
            </div>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Coming Soon</CardTitle>
            </CardHeader>
            <CardContent>
                <p>The timesheet reporting and viewing functionality is currently under construction. You can log time from the Workspace page.</p>
            </CardContent>
        </Card>
    </div>
  );
}
