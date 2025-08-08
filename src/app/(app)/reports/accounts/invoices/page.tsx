
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { ArrowLeft, CalendarIcon, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { DateRange } from "react-day-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";


export default function InvoicesReportPage() {
  const router = useRouter();
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: addDays(new Date(), -90),
    to: new Date(),
  });

  return (
    <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.push('/reports/accounts')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Accounts Reports
        </Button>

        <Card>
            <CardHeader>
                <CardTitle>Invoices Report</CardTitle>
                <CardDescription>Filter and export a detailed list of invoices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div className="grid gap-2">
                        <Label>Firm</Label>
                        <Select defaultValue="all">
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Firms</SelectItem>
                                <SelectItem value="dmv">Davis, Martin & Varghese</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Date Range</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                "w-full justify-start text-left font-normal",
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
                                <span>Pick a date range</span>
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
                    </div>
                     <div className="flex gap-2 items-end">
                        <Button variant="outline" className="w-full">This Month</Button>
                        <Button variant="outline" className="w-full">This Quarter</Button>
                        <Button variant="outline" className="w-full">FY 24-25</Button>
                    </div>
                    <div className="grid gap-2">
                        <Label>Group By</Label>
                         <Select defaultValue="none">
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="client">Client</SelectItem>
                                <SelectItem value="engagementType">Engagement Type</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                 <div className="flex justify-end">
                    <Button>
                        <Download className="mr-2 h-4 w-4" />
                        Export to CSV
                    </Button>
                </div>
                <ScrollArea className="h-96 w-full rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Engagement</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    Data will be loaded here based on your filters.
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    </div>
  );
}
