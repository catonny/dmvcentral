
"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";
import { addDays, format, parseISO } from "date-fns";
import { CalendarIcon, Loader2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { cn } from "@/lib/utils";
import type { Engagement, Employee, EngagementType } from "@/lib/data";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";


interface PastEngagementsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  employees: Employee[];
  engagementTypes: EngagementType[];
}

const statusColors: { [key: string]: string } = {
  "Pending": "bg-gray-200 text-gray-800",
  "Awaiting Documents": "bg-yellow-200 text-yellow-800",
  "In Process": "bg-blue-200 text-blue-800",
  "Partner Review": "bg-purple-200 text-purple-800",
  "Completed": "bg-green-200 text-green-800",
  "Cancelled": "bg-red-200 text-red-800",
};


export function PastEngagementsDialog({ isOpen, onClose, clientId, clientName, employees, engagementTypes }: PastEngagementsDialogProps) {
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: addDays(new Date(), -365),
    to: new Date(),
  });
  const [pastEngagements, setPastEngagements] = React.useState<Engagement[]>([]);
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  const handleFetchEngagements = async () => {
    if (!date?.from || !date?.to) {
        toast({ title: "Invalid Date Range", description: "Please select a valid start and end date.", variant: "destructive"});
        return;
    }
    setLoading(true);
    setPastEngagements([]);
    try {
        const engagementsQuery = query(
            collection(db, "engagements"),
            where("clientId", "==", clientId),
            where("dueDate", ">=", date.from.toISOString()),
            where("dueDate", "<=", date.to.toISOString()),
            orderBy("dueDate", "desc")
        );
        const snapshot = await getDocs(engagementsQuery);
        const fetchedData = snapshot.docs.map(doc => doc.data() as Engagement);
        setPastEngagements(fetchedData);

        if(fetchedData.length === 0) {
             toast({ title: "No Engagements Found", description: "No engagements found for the selected date range."});
        }
    } catch (error) {
        console.error("Error fetching past engagements:", error);
        toast({ title: "Error", description: "Failed to fetch past engagements.", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  }
  
  const getEmployeeMember = (employeeId: string) => employees.find(s => s.id === employeeId);
  const getEngagementType = (typeId: string) => engagementTypes.find(et => et.id === typeId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Past Engagements for {clientName}</DialogTitle>
          <DialogDescription>
            Select a date range to view historical engagement data for this client.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
           <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button onClick={handleFetchEngagements} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Fetch Engagements
          </Button>
        </div>
        <div className="flex-grow overflow-hidden border rounded-md">
            <ScrollArea className="h-full">
                <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                        <TableRow>
                            <TableHead>Remarks</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Assigned To</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pastEngagements.length > 0 ? (
                           pastEngagements.map((eng) => {
                                const assignedEmployee = getEmployeeMember(eng.assignedTo);
                                const engagementType = getEngagementType(eng.type);
                                return (
                                <TableRow key={eng.id}>
                                    <TableCell className="font-medium">{eng.remarks}</TableCell>
                                    <TableCell>{engagementType?.name || 'N/A'}</TableCell>
                                    <TableCell>{format(parseISO(eng.dueDate), "dd MMM, yyyy")}</TableCell>
                                    <TableCell>
                                    <Badge className={`${statusColors[eng.status] || ''} hover:${statusColors[eng.status] || ''}`}>
                                        {eng.status}
                                    </Badge>
                                    </TableCell>
                                    <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8">
                                        <AvatarImage src={assignedEmployee?.avatar} alt={assignedEmployee?.name} />
                                        <AvatarFallback>{assignedEmployee?.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <span>{assignedEmployee?.name || 'Unassigned'}</span>
                                    </div>
                                    </TableCell>
                                </TableRow>
                                );
                            })
                        ) : (
                             <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                {loading ? 'Loading...' : 'No past engagements to display for this range. Try fetching new dates.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
