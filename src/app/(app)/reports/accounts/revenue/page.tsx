
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
import { ArrowLeft, CalendarIcon, Download, PiggyBank, CircleDollarSign, Hourglass } from "lucide-react";
import { useRouter } from "next/navigation";
import { DateRange } from "react-day-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

const KpiCard = ({ title, value, icon: Icon }: { title: string, value: string, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
)

export default function RevenueReportPage() {
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
                <CardTitle>Revenue Report</CardTitle>
                <CardDescription>Analyze revenue, collections, and pending amounts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     <div className="lg:col-span-2 grid gap-4 items-end grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
                                    className={cn("w-full justify-start text-left font-normal",!date && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>) : (format(date.from, "LLL dd, y"))) : (<span>Pick a date range</span>)}
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
                        </div>
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <KpiCard title="Total Revenue" value="₹0" icon={CircleDollarSign} />
                    <KpiCard title="Total Collected" value="₹0" icon={PiggyBank} />
                    <KpiCard title="Total Pending" value="₹0" icon={Hourglass} />
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
                                <TableHead>Group</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                                <TableHead className="text-right">Collected</TableHead>
                                <TableHead className="text-right">Pending</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
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
