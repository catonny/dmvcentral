
"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { ArrowLeft, CalendarIcon, Download, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { DateRange } from "react-day-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Invoice, Firm, Client } from "@/lib/data";
import Papa from "papaparse";

export default function InvoicesReportPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [firms, setFirms] = React.useState<Firm[]>([]);
  const [clients, setClients] = React.useState<Map<string, Client>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [filteredInvoices, setFilteredInvoices] = React.useState<Invoice[]>([]);

  const [selectedFirmId, setSelectedFirmId] = React.useState<string>("all");
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: addDays(new Date(), -90),
    to: new Date(),
  });

  React.useEffect(() => {
    setLoading(true);
    const unsubInvoices = onSnapshot(collection(db, "invoices"), (snapshot) => {
        setInvoices(snapshot.docs.map(doc => doc.data() as Invoice));
        setLoading(false);
    }, (error) => {
        toast({ title: "Error", description: "Failed to fetch invoices.", variant: "destructive" });
        setLoading(false);
    });

    const unsubFirms = onSnapshot(collection(db, "firms"), (snapshot) => {
        setFirms(snapshot.docs.map(doc => doc.data() as Firm));
    });
    
    const unsubClients = onSnapshot(collection(db, "clients"), (snapshot) => {
        setClients(new Map(snapshot.docs.map(doc => [doc.id, doc.data() as Client])));
    });

    return () => {
        unsubInvoices();
        unsubFirms();
        unsubClients();
    };
  }, [toast]);
  
  React.useEffect(() => {
      let filtered = invoices;

      if (selectedFirmId !== "all") {
          filtered = filtered.filter(inv => inv.firmId === selectedFirmId);
      }

      if (date?.from && date?.to) {
           filtered = filtered.filter(inv => {
               const issueDate = parseISO(inv.issueDate);
               return issueDate >= date.from! && issueDate <= date.to!;
           });
      }
      
      setFilteredInvoices(filtered);

  }, [invoices, selectedFirmId, date]);

  const handleExport = () => {
    const dataToExport = filteredInvoices.map(invoice => ({
        "Invoice Number": invoice.invoiceNumber,
        "Issue Date": format(parseISO(invoice.issueDate), 'yyyy-MM-dd'),
        "Client Name": clients.get(invoice.clientId)?.name || invoice.clientId,
        "Client GSTN": clients.get(invoice.clientId)?.gstin || 'N/A',
        "Firm Name": firms.find(f => f.id === invoice.firmId)?.name || 'N/A',
        "Status": invoice.status,
        "Sub Total": invoice.subTotal,
        "Discount": invoice.totalDiscount,
        "Taxable Amount": invoice.taxableAmount,
        "Total Tax": invoice.totalTax,
        "Total Amount": invoice.totalAmount,
    }));
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `invoice_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exported!", description: "The invoice report has been downloaded as a CSV file." });
  }


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
                        <Select value={selectedFirmId} onValueChange={setSelectedFirmId}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Firms</SelectItem>
                                {firms.map(firm => <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>)}
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
                        <Button variant="outline" className="w-full" onClick={() => setDate({from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), to: new Date()})}>This Month</Button>
                        <Button variant="outline" className="w-full" onClick={() => setDate({from: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1), to: new Date()})}>This Quarter</Button>
                    </div>
                     <div className="flex justify-end col-span-full lg:col-span-1">
                        <Button onClick={handleExport} disabled={filteredInvoices.length === 0}>
                            <Download className="mr-2 h-4 w-4" />
                            Export to CSV
                        </Button>
                    </div>
                </div>
                
                <ScrollArea className="h-96 w-full rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                             {loading ? (
                                 <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                             ) : filteredInvoices.length > 0 ? (
                                 filteredInvoices.map(invoice => (
                                     <TableRow key={invoice.id}>
                                         <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                                         <TableCell>{format(parseISO(invoice.issueDate), 'dd MMM, yyyy')}</TableCell>
                                         <TableCell>{clients.get(invoice.clientId)?.name || 'Unknown'}</TableCell>
                                         <TableCell>{invoice.status}</TableCell>
                                         <TableCell className="text-right font-mono">₹{invoice.totalAmount.toFixed(2)}</TableCell>
                                     </TableRow>
                                 ))
                             ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No invoices found for the selected filters.
                                    </TableCell>
                                </TableRow>
                             )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
    </div>
  );
}
