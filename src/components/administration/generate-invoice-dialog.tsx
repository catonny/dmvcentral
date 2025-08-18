

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
import type { Engagement, Client, EngagementType, Firm, SalesItem, TaxRate, HsnSacCode, Invoice, Employee } from "@/lib/data";
import { indianStatesAndUTs } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { SearchableSelectWithCreate } from "../masters/searchable-select-with-create";
import { EditSalesItemDialog } from "../masters/edit-sales-item-dialog";
import { format, parseISO } from "date-fns";
import { Switch } from "../ui/switch";

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

interface GenerateInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (engagementId: string, invoiceData: Omit<Invoice, 'id'>) => Promise<void>;
  entry: {
    engagement: Engagement;
    client: Client;
    engagementType: EngagementType;
  } | null;
  firms: Firm[];
  salesItems: SalesItem[];
  taxRates: TaxRate[];
  hsnSacCodes: HsnSacCode[];
  employees: Map<string, Employee>;
}

export function GenerateInvoiceDialog({
  isOpen,
  onClose,
  onSave,
  entry,
  firms,
  salesItems,
  taxRates,
  hsnSacCodes,
  employees
}: GenerateInvoiceDialogProps) {
  const [lineItems, setLineItems] = React.useState<LineItem[]>([]);
  const [selectedFirmId, setSelectedFirmId] = React.useState<string>("");
  const [placeOfSupply, setPlaceOfSupply] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [additionalDiscount, setAdditionalDiscount] = React.useState<number>(0);
  const { toast } = useToast();
  
  const [isSalesItemDialogOpen, setIsSalesItemDialogOpen] = React.useState(false);
  const [itemToEdit, setItemToEdit] = React.useState<Partial<SalesItem> | null>(null);
  const [showAllSalesItems, setShowAllSalesItems] = React.useState(false);

  React.useEffect(() => {
    if (entry) {
        // Use the new single associatedEngagementTypeId for filtering
        const recommendedItems = salesItems.filter(si => si.associatedEngagementTypeId === entry.engagement.type);

        const initialLineItems: LineItem[] = recommendedItems.map(salesItem => {
            return {
                id: `item-${salesItem.id}-${Date.now()}`,
                salesItemId: salesItem.id,
                description: salesItem?.description || '',
                quantity: 1,
                rate: salesItem?.standardPrice || 0,
                discount: 0,
                taxRateId: salesItem?.defaultTaxRateId || taxRates.find(t => t.isDefault)?.id || '',
                sacCodeId: salesItem?.defaultSacId || hsnSacCodes.find(h => h.isDefault)?.id || ''
            };
        });

        // If no recommended items, create a default line item from the engagement itself
        if (initialLineItems.length === 0) {
            initialLineItems.push({
                id: `item-${Date.now()}`,
                salesItemId: '',
                description: entry.engagement.remarks,
                quantity: 1,
                rate: entry.engagement.fees || 0,
                discount: 0,
                taxRateId: taxRates.find(t => t.isDefault)?.id || '',
                sacCodeId: hsnSacCodes.find(h => h.isDefault)?.id || ''
            });
        }
        
        setLineItems(initialLineItems);
        setSelectedFirmId(entry.client.firmId || (firms.length > 0 ? firms[0].id : ""));
        setPlaceOfSupply(entry.client.State || "");
        setAdditionalDiscount(0);
        setShowAllSalesItems(false);
    }
  }, [entry, firms, salesItems, taxRates, hsnSacCodes]);

  const handleSave = async () => {
    if (!entry) return;

    if (lineItems.length === 0 || lineItems.some(li => !li.salesItemId)) {
        toast({ title: "Validation Error", description: "Please add at least one valid line item to the invoice.", variant: "destructive"});
        return;
    }

    setIsSaving(true);
    try {
        const { total, subTotal, taxableAmount, totalTax, totalLineItemDiscount } = calculateTotals();
        
        const invoiceData: Omit<Invoice, 'id'> = {
            invoiceNumber: `INV-${new Date().getFullYear()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            clientId: entry.client.id,
            clientName: entry.client.name,
            engagementId: entry.engagement.id,
            firmId: selectedFirmId,
            issueDate: new Date().toISOString(),
            dueDate: new Date().toISOString(),
            lineItems: lineItems.map(li => ({ ...li, total: (li.quantity * li.rate) - li.discount, taxAmount: 0 })), // taxAmount needs real calc
            subTotal: subTotal,
            totalDiscount: totalLineItemDiscount + additionalDiscount,
            taxableAmount: taxableAmount,
            totalTax: totalTax,
            totalAmount: total,
            status: 'Sent',
            tallyClientLedgerName: entry.client.name, // Default mapping
        };

        await onSave(entry.engagement.id, invoiceData);
        toast({
            title: "Invoice Generated!",
            description: `The invoice has been created successfully.`
        });
        onClose();
    } catch (error) {
        console.error("Error generating invoice:", error);
        toast({
            title: "Error",
            description: "Could not generate the invoice.",
            variant: "destructive",
        });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleCreateNewSalesItem = (itemName: string) => {
    setItemToEdit({ name: itemName, associatedEngagementTypeId: entry?.engagement.type });
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
                    // Apply additional discount proportionally for tax calculation
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

  if (!entry) return null;
  
  const assignedToNames = entry.engagement.assignedTo.map(id => employees.get(id)?.name).filter(Boolean).join(", ");
  const partnerName = employees.get(entry.client.partnerId)?.name || 'N/A';

  const availableSalesItems = showAllSalesItems
    ? salesItems
    : salesItems.filter(si => !si.associatedEngagementTypeId || si.associatedEngagementTypeId === entry.engagement.type);


  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
            <div className="flex justify-between items-start">
                <div>
                    <DialogTitle>Generate Invoice for {entry.client.name}</DialogTitle>
                    <DialogDescription className="space-y-1 pt-2">
                        <div><b>Engagement Type:</b> {entry.engagementType.name}</div>
                        <div><b>Done by:</b> {assignedToNames}</div>
                        <div><b>Partner:</b> {partnerName}</div>
                    </DialogDescription>
                </div>
                {entry.engagement.billSubmissionDate && (
                     <div className="text-sm text-muted-foreground">
                        <b>Completed on:</b> {format(parseISO(entry.engagement.billSubmissionDate), "dd MMM, yyyy")}
                    </div>
                )}
            </div>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
                     <Select value={placeOfSupply} onValueChange={setPlaceOfSupply}>
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
                                        options={availableSalesItems.map(si => ({ value: si.id, label: si.name }))}
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
                 <div className="p-2 flex justify-between items-center">
                     <Button variant="outline" size="sm" onClick={addLineItem}><PlusCircle className="mr-2"/>Add Line Item</Button>
                     <div className="flex items-center space-x-2">
                        <Label htmlFor="show-all-items" className="text-sm">Show all items</Label>
                        <Switch id="show-all-items" checked={showAllSalesItems} onCheckedChange={setShowAllSalesItems} />
                    </div>
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
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Invoice
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
