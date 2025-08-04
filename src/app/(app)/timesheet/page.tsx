
"use client";

import * as React from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import type { Timesheet, Employee, Engagement, Client } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { DateRange } from "react-day-picker";
import { startOfWeek, endOfWeek, format, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export default function TimesheetPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isAdminOrPartner, setIsAdminOrPartner] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [timesheets, setTimesheets] = React.useState<Timesheet[]>([]);
  const [engagements, setEngagements] = React.useState<Map<string, Engagement>>(new Map());
  const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
  
  const [date, setDate] = React.useState<Date>(new Date());
  const [weekStart, setWeekStart] = React.useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [openCollapsibleId, setOpenCollapsibleId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const checkUserRole = async () => {
      const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
      const unsub = onSnapshot(employeeQuery, (snapshot) => {
        if (!snapshot.empty) {
          const employeeData = snapshot.docs[0].data() as Employee;
          if (employeeData.role.includes("Admin") || employeeData.role.includes("Partner")) {
            setIsAdminOrPartner(true);
          }
        }
        setLoading(false);
      });
      return () => unsub();
    };

    checkUserRole();
  }, [user, authLoading]);

  React.useEffect(() => {
    if (!isAdminOrPartner) return;

    // Fetch master data once
    const unsubEngagements = onSnapshot(collection(db, "engagements"), (snapshot) => {
        setEngagements(new Map(snapshot.docs.map(doc => [doc.id, doc.data() as Engagement])));
    });
     const unsubClients = onSnapshot(collection(db, "clients"), (snapshot) => {
        setClients(new Map(snapshot.docs.map(doc => [doc.id, doc.data() as Client])));
    });
    
    return () => {
        unsubEngagements();
        unsubClients();
    }
  }, [isAdminOrPartner]);
  
  React.useEffect(() => {
    if (!isAdminOrPartner) return;

    const newWeekStart = startOfWeek(date, { weekStartsOn: 1 });
    if (!isSameDay(newWeekStart, weekStart)) {
        setWeekStart(newWeekStart);
    }
  }, [date, isAdminOrPartner, weekStart]);

  React.useEffect(() => {
    if (!isAdminOrPartner) return;
    
    setLoading(true);
    const formattedWeekStart = format(weekStart, 'yyyy-MM-dd');
    const q = query(
        collection(db, "timesheets"), 
        where("weekStartDate", ">=", new Date(formattedWeekStart).toISOString())
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const weeklyTimesheets = snapshot.docs
            .map(doc => doc.data() as Timesheet)
            .filter(ts => ts.weekStartDate.startsWith(formattedWeekStart));
      
        setTimesheets(weeklyTimesheets);
        setLoading(false);
    }, (error) => {
      console.error("Error fetching timesheets:", error);
      toast({ title: "Error", description: "Failed to fetch timesheet data.", variant: "destructive" });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdminOrPartner, toast, weekStart]);


  if (authLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdminOrPartner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>You do not have the required permissions to view timesheets.</p>
        </CardContent>
      </Card>
    );
  }
  
  const weeklyHoursSummary = timesheets.sort((a,b) => a.userName.localeCompare(b.userName));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Timesheets</h2>
          <p className="text-muted-foreground">Review weekly logged hours for your team.</p>
        </div>
        <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                {`Week of ${format(weekStart, "MMMM dd, yyyy")}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => setDate(d || new Date())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Weekly Summary</CardTitle>
            <CardDescription>
                Total hours logged for the week of {format(weekStart, 'MMMM dd, yyyy')}. Non-partners with less than 35 hours are highlighted.
            </CardDescription>
        </CardHeader>
        <CardContent>
             <ScrollArea className="h-[60vh]">
                <Table>
                    <TableHeader className="sticky top-0 bg-muted z-10">
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Employee</TableHead>
                            <TableHead className="text-right">Total Hours</TableHead>
                        </TableRow>
                    </TableHeader>
                    {loading ? (
                         <TableBody>
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    ) : weeklyHoursSummary.length > 0 ? (
                        weeklyHoursSummary.map(ts => {
                            const isDeficit = !ts.isPartner && ts.totalHours < 35;
                            const isOpen = openCollapsibleId === ts.id;
                            return (
                                <Collapsible asChild key={ts.id} open={isOpen} onOpenChange={() => setOpenCollapsibleId(isOpen ? null : ts.id)}>
                                    <TableBody>
                                        <TableRow className={cn("font-medium", isDeficit && "bg-destructive/10 text-destructive")}>
                                            <TableCell>
                                                <CollapsibleTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        {ts.entries.length > 0 ? (
                                                            <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
                                                        ) : null}
                                                    </Button>
                                                </CollapsibleTrigger>
                                            </TableCell>
                                            <TableCell className="flex items-center gap-2">
                                                {isDeficit && <AlertTriangle className="h-4 w-4" />}
                                                {ts.userName}
                                                {ts.isPartner && <Badge variant="secondary">Partner</Badge>}
                                            </TableCell>
                                            <TableCell className="text-right">{ts.totalHours.toFixed(2)}</TableCell>
                                        </TableRow>
                                        <CollapsibleContent asChild>
                                             <tr>
                                                <td colSpan={3} className="p-0">
                                                    <div className="p-4 bg-muted/50">
                                                        <h4 className="font-semibold mb-2 text-sm pl-4">Engagement Breakdown</h4>
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead className="pl-8">Engagement</TableHead>
                                                                    <TableHead>Client</TableHead>
                                                                    <TableHead className="text-right">Hours Logged</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {ts.entries.map(entry => {
                                                                    const engagement = engagements.get(entry.engagementId);
                                                                    const client = engagement ? clients.get(engagement.clientId) : undefined;
                                                                    return (
                                                                        <TableRow key={entry.engagementId}>
                                                                            <TableCell className="pl-8">{engagement?.remarks || 'Engagement not found'}</TableCell>
                                                                            <TableCell>{client?.Name || 'Client not found'}</TableCell>
                                                                            <TableCell className="text-right">{entry.hours.toFixed(2)}</TableCell>
                                                                        </TableRow>
                                                                    )
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </td>
                                             </tr>
                                        </CollapsibleContent>
                                    </TableBody>
                                </Collapsible>
                            )
                        })
                    ) : (
                         <TableBody>
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    No timesheets found for this week.
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    )}
                </Table>
             </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

    