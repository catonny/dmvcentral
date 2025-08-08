
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Engagement, Client, EngagementType, Firm, SalesItem, TaxRate, HsnSacCode, Invoice, InvoiceLineItem } from "@/lib/data";
import { indianStatesAndUTs } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { SearchableSelectWithCreate } from "../masters/searchable-select-with-create";
import { EditSalesItemDialog } from "../masters/edit-sales-item-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { cn } from "@/lib/utils";

interface CreateAdHocInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoiceData: Omit<Invoice, 'id'>, engagementData: Omit<Engagement, 'id'>) => Promise<void>;
  clients: Client[];
  engagementTypes: EngagementType[];
  employees: Employee[];
  firms: Firm[];
  salesItems: SalesItem[];
  taxRates: TaxRate[];
  hsnSacCodes: HsnSacCode[];
}

export function CreateAdHocInvoiceDialog({
  isOpen,
  onClose,
  onSave,
  clients,
  engagementTypes,
  employees,
  firms,
  salesItems,
  taxRates,
  hsnSacCodes,
}: CreateAdHocInvoiceDialogProps) {
  const [lineItems, setLineItems] = React.useState<LineItem[]>([]);
  const [selectedFirmId, setSelectedFirmId] = React.useState<string>("");
  const [selectedClientId, setSelectedClientId] = React.useState<string>("");
  const [selectedEngagementTypeId, setSelectedEngagementTypeId] = React.useState<string>("");
  const [assignedTo, setAssignedTo] = React.useState<string[]>([]);
  const [reportedTo, setReportedTo] = React.useState<string>("");
  const [remarks, setRemarks] = React.useState("");

  const [placeOfSupply, setPlaceOfSupply] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [additionalDiscount, setAdditionalDiscount] = React.useState<number>(0);
  const { toast } = useToast();
  
  const [isSalesItemDialogOpen, setIsSalesItemDialogOpen] = React.useState(false);
  const [itemToEdit, setItemToEdit] = React.useState<Partial<SalesItem> | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      // Reset state when dialog opens
      setLineItems([]);
      setSelectedFirmId(firms.length > 0 ? firms[0].id : "");
      setSelectedClientId("");
      setSelectedEngagementTypeId("");
      setAssignedTo([]);
      setReportedTo("");
      setRemarks("");
      setPlaceOfSupply("");
      setAdditionalDiscount(0);
    }
  }, [isOpen, firms]);
  
  React.useEffect(() => {
    if (selectedClientId) {
        const client = clients.find(c => c.id === selectedClientId);
        if (client) {
            setPlaceOfSupply(client.State || "");
            if (client.partnerId) {
                setReportedTo(client.partnerId);
            }
        }
    }
  }, [selectedClientId, clients]);

  const handleSave = async () => {
    if (!selectedClientId || !selectedEngagementTypeId || assignedTo.length === 0 || !reportedTo || !remarks) {
        toast({ title: "Validation Error", description: "Please fill all required fields in the Engagement Details section.", variant: "destructive"});
        return;
    }
    
    if (lineItems.length === 0 || lineItems.some(li => !li.salesItemId)) {
         toast({ title: "Validation Error", description: "Please add at least one valid line item to the invoice.", variant: "destructive"});
        return;
    }

    setIsSaving(true);
    try {
        const { total, subTotal, taxableAmount, totalTax, totalLineItemDiscount } = calculateTotals();
        
        const invoiceData: Omit<Invoice, 'id'> = {
            invoiceNumber: `INV-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            clientId: selectedClientId,
            clientName: clients.find(c => c.id === selectedClientId)?.name || "Unknown",
            engagementId: '', // This will be set in the parent component
            firmId: selectedFirmId,
            issueDate: new Date().toISOString(),
            dueDate: new Date().toISOString(),
            lineItems: lineItems.map(li => ({ ...li, total: (li.quantity * li.rate) - li.discount, taxAmount: 0 })), // taxAmount needs real calc
            subTotal: subTotal,
            totalDiscount: totalLineItemDiscount + additionalDiscount,
            taxableAmount: taxableAmount,
            totalTax: totalTax,
            totalAmount: total,
            status: 'Sent'
        };

        const engagementData: Omit<Engagement, 'id'> = {
            clientId: selectedClientId,
            type: selectedEngagementTypeId,
            remarks: remarks,
            assignedTo: assignedTo,
            reportedTo: reportedTo,
            dueDate: new Date().toISOString(),
            status: "Completed",
            fees: total
        };

        await onSave(invoiceData, engagementData);

    } catch (error) {
        console.error("Error creating ad-hoc invoice:", error);
        toast({ title: "Error", description: "Could not create the ad-hoc invoice.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleCreateNewSalesItem = (itemName: string) => {
    setItemToEdit({ name: itemName });
    setIsSalesItemDialogOpen(true);
  }

  const handleLineItemChange = (index: number, field: keyof LineItem, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'salesItemId') {
        const selectedItem = salesItems.find(si => si.id === value);
        if (selectedItem) {
            updatedItems[index].description = selectedItem.description;
            updatedItems[index].rate = selectedItem.standardPrice;
            updatedItems[index].taxRateId = selectedItem.defaultTaxRateId;
            updatedItems[index].sacCodeId = selectedItem.defaultSacId;
        }
    }

    setLineItems(updatedItems);
  }
  
  const addLineItem = () => {
      setLineItems([...lineItems, {
        id: `item-${Date.now()}`,
        salesItemId: '',
        description: '',
        quantity: 1,
        rate: 0,
        discount: 0,
        taxRateId: taxRates.find(t => t.isDefault)?.id || '',
        sacCodeId: hsnSacCodes.find(h => h.isDefault)?.id || ''
      }]);
  }
  
  const removeLineItem = (index: number) => {
      setLineItems(lineItems.filter((_, i) => i !== index));
  }
  
  const calculateTotals = () => {
      let grossTotal = 0;
      let totalLineItemDiscount = 0;
      let cgst = 0;
      let sgst = 0;
      let igst = 0;
      
      const selectedFirm = firms.find(f => f.id === selectedFirmId);
      const firmHasGst = !!selectedFirm?.gstn;
      const isInterstate = selectedFirm?.state !== placeOfSupply;

      lineItems.forEach(item => {
          grossTotal += item.quantity * item.rate;
          totalLineItemDiscount += item.discount;
      });
      
      const subTotal = grossTotal - totalLineItemDiscount;
      const taxableAmount = subTotal - additionalDiscount;
      
      if (firmHasGst && taxableAmount > 0) {
          lineItems.forEach(item => {
              const itemTotal = item.quantity * item.rate;
              const itemDiscount = item.discount;
              const itemTaxableAmount = itemTotal - itemDiscount;

              if (itemTaxableAmount > 0) {
                const tax = taxRates.find(t => t.id === item.taxRateId);
                if (tax && tax.rate > 0) {
                    const proportionalAdditionalDiscount = (itemTaxableAmount / subTotal) * additionalDiscount;
                    const finalItemTaxableAmount = itemTaxableAmount - proportionalAdditionalDiscount;
                    
                    const taxAmount = finalItemTaxableAmount * (tax.rate / 100);
                    if (isInterstate) {
                        igst += taxAmount;
                    } else {
                        cgst += taxAmount / 2;
                        sgst += taxAmount / 2;
                    }
                }
              }
          });
      }
      
      const totalTax = cgst + sgst + igst;
      const total = taxableAmount + totalTax;
      return { subTotal, cgst, sgst, igst, total, taxableAmount, grossTotal, totalLineItemDiscount, totalTax };
  }
  
  const { subTotal, cgst, sgst, igst, total, taxableAmount } = calculateTotals();

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Create Ad-Hoc Invoice</DialogTitle>
          <DialogDescription>
            For work done without a prior engagement. This will create a completed engagement and an invoice simultaneously.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
            {/* Engagement Details Section */}
             <div className="space-y-4 p-4 border rounded-lg">
                <h3 className="font-semibold text-lg">Engagement Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <Label>Client*</Label>
                        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                            <SelectTrigger><SelectValue placeholder="Select client..."/></SelectTrigger>
                            <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label>Engagement Type*</Label>
                        <Select value={selectedEngagementTypeId} onValueChange={setSelectedEngagementTypeId}>
                            <SelectTrigger><SelectValue placeholder="Select type..."/></SelectTrigger>
                            <SelectContent>{engagementTypes.map(et => <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <div>
                        <Label>Remarks*</Label>
                        <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g., Special Consultation"/>
                    </div>
                     <div>
                        <Label>Assigned To*</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-start">{assignedTo.length > 0 ? `${assignedTo.length} selected` : "Select employees..."}</Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                                <Command>
                                    <CommandInput placeholder="Search..." />
                                    <CommandList>
                                        <CommandEmpty>No results found.</CommandEmpty>
                                        <CommandGroup>
                                            {employees.map(emp => (
                                                <CommandItem key={emp.id} onSelect={() => setAssignedTo(prev => prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id])}>
                                                    <Check className={cn("mr-2 h-4 w-4", assignedTo.includes(emp.id) ? "opacity-100" : "opacity-0")} />
                                                    {emp.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                     <div>
                        <Label>Reports To*</Label>
                        <Select value={reportedTo} onValueChange={setReportedTo}>
                            <SelectTrigger><SelectValue placeholder="Select manager..."/></SelectTrigger>
                            <SelectContent>{employees.filter(e => e.role.includes("Manager") || e.role.includes("Partner")).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
             </div>

            {/* Invoice Details Section */}
            <div className="space-y-4 p-4 border rounded-lg">
                 <h3 className="font-semibold text-lg">Invoice Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="firm">Issuing Firm</Label>
                        <Select value={selectedFirmId} onValueChange={setSelectedFirmId}>
                            <SelectTrigger id="firm"><SelectValue placeholder="Select a firm..." /></SelectTrigger>
                            <SelectContent>
                                {firms.map(firm => <SelectItem key={firm.id} value={firm.id}>{firm.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="placeOfSupply">Place of Supply</Label>
                        <Select value={placeOfSupply} onValueChange={setPlaceOfSupply} disabled={!selectedClientId}>
                            <SelectTrigger id="placeOfSupply"><SelectValue placeholder="Select state..." /></SelectTrigger>
                            <SelectContent>
                                {indianStatesAndUTs.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[30%]">Item</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Rate</TableHead>
                                <TableHead>Discount</TableHead>
                                <TableHead>Tax</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lineItems.map((item, index) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <SearchableSelectWithCreate
                                            value={item.salesItemId}
                                            onValueChange={(value) => handleLineItemChange(index, 'salesItemId', value)}
                                            placeholder="Select an item..."
                                            searchPlaceholder="Search items..."
                                            emptyResultText="No items found."
                                            options={salesItems.map(si => ({ value: si.id, label: si.name }))}
                                            onCreateNew={handleCreateNewSalesItem}
                                        />
                                    </TableCell>
                                    <TableCell><Input type="number" value={item.quantity} onChange={(e) => handleLineItemChange(index, 'quantity', Number(e.target.value) || 0)} className="w-16"/></TableCell>
                                    <TableCell><Input type="number" value={item.rate} onChange={(e) => handleLineItemChange(index, 'rate', Number(e.target.value) || 0)} className="w-24"/></TableCell>
                                    <TableCell><Input type="number" value={item.discount} onChange={(e) => handleLineItemChange(index, 'discount', Number(e.target.value) || 0)} className="w-24" placeholder="0.00"/></TableCell>
                                    <TableCell>
                                        <Select value={item.taxRateId} onValueChange={(value) => handleLineItemChange(index, 'taxRateId', value)}>
                                            <SelectTrigger className="w-[120px]"><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                {taxRates.map(tr => <SelectItem key={tr.id} value={tr.id}>{tr.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{((item.quantity * item.rate) - item.discount).toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => removeLineItem(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <div className="p-2 flex justify-start">
                        <Button variant="outline" size="sm" onClick={addLineItem}><PlusCircle className="mr-2"/>Add Line Item</Button>
                    </div>
                </div>
                <div className="flex justify-end">
                    <div className="w-1/3 space-y-2">
                        <div className="flex justify-between font-mono"><span className="text-muted-foreground">Sub Total:</span> <span>{subTotal.toFixed(2)}</span></div>
                        <div className="flex justify-between items-center font-mono">
                            <Label htmlFor="additionalDiscount" className="text-muted-foreground">Additional Discount:</Label>
                            <Input
                                id="additionalDiscount"
                                type="number"
                                value={additionalDiscount || ''}
                                onChange={(e) => setAdditionalDiscount(Number(e.target.value) || 0)}
                                className="w-24 h-8"
                                placeholder="0.00"
                            />
                        </div>
                        <div className="flex justify-between font-mono border-t pt-2 mt-2"><span className="text-muted-foreground">Taxable Amount:</span> <span>{taxableAmount.toFixed(2)}</span></div>
                        {igst > 0 && <div className="flex justify-between font-mono"><span className="text-muted-foreground">IGST:</span> <span>{igst.toFixed(2)}</span></div>}
                        {cgst > 0 && <div className="flex justify-between font-mono"><span className="text-muted-foreground">CGST:</span> <span>{cgst.toFixed(2)}</span></div>}
                        {sgst > 0 && <div className="flex justify-between font-mono"><span className="text-muted-foreground">SGST:</span> <span>{sgst.toFixed(2)}</span></div>}
                        <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2"><span className="text-foreground">Total:</span> <span>₹{total.toFixed(2)}</span></div>
                    </div>
                </div>
            </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <EditSalesItemDialog
        isOpen={isSalesItemDialogOpen}
        onClose={() => setIsSalesItemDialogOpen(false)}
        salesItem={itemToEdit}
        taxRates={taxRates}
        hsnSacCodes={hsnSacCodes}
    />
    </>
  );
}

// Minimal LineItem type for local state
interface LineItem {
    id: string;
    salesItemId: string;
    description: string;
    quantity: number;
    rate: number;
    discount: number;
    taxRateId: string;
    sacCodeId: string;
}
