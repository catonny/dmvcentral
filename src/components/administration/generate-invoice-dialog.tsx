
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
import type { Engagement, Client, EngagementType, Firm, SalesItem, TaxRate, HsnSacCode } from "@/lib/data";
import { indianStatesAndUTs } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { SearchableSelectWithCreate } from "../masters/searchable-select-with-create";
import { EditSalesItemDialog } from "../masters/edit-sales-item-dialog";

interface LineItem {
    id: string;
    salesItemId: string;
    description: string;
    quantity: number;
    rate: number;
    taxRateId: string;
    sacCodeId: string;
}

interface GenerateInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (engagementId: string, totalAmount: number) => Promise<void>;
  entry: {
    engagement: Engagement;
    client: Client;
    engagementType: EngagementType;
  } | null;
  firms: Firm[];
  salesItems: SalesItem[];
  taxRates: TaxRate[];
  hsnSacCodes: HsnSacCode[];
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
}: GenerateInvoiceDialogProps) {
  const [lineItems, setLineItems] = React.useState<LineItem[]>([]);
  const [selectedFirmId, setSelectedFirmId] = React.useState<string>("");
  const [placeOfSupply, setPlaceOfSupply] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();
  
  // State for the EditSalesItemDialog
  const [isSalesItemDialogOpen, setIsSalesItemDialogOpen] = React.useState(false);
  const [itemToEdit, setItemToEdit] = React.useState<Partial<SalesItem> | null>(null);

  React.useEffect(() => {
    if (entry) {
        // Find a matching sales item
        const matchingSalesItem = salesItems.find(si => si.name.toLowerCase() === entry.engagementType.name.toLowerCase());
        
        const initialLineItems: LineItem[] = [{
            id: `item-${Date.now()}`,
            salesItemId: matchingSalesItem?.id || '',
            description: entry.engagement.remarks,
            quantity: 1,
            rate: entry.engagement.fees || matchingSalesItem?.standardPrice || 0,
            taxRateId: matchingSalesItem?.defaultTaxRateId || taxRates.find(t => t.isDefault)?.id || '',
            sacCodeId: matchingSalesItem?.defaultSacId || hsnSacCodes.find(h => h.isDefault)?.id || ''
        }];
        setLineItems(initialLineItems);
        setSelectedFirmId(entry.client.firmId || (firms.length > 0 ? firms[0].id : ""));
        setPlaceOfSupply(entry.client.State || "");
    }
  }, [entry, firms, salesItems, taxRates, hsnSacCodes]);

  const handleSave = async () => {
    if (!entry || !selectedFirmId || lineItems.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select a firm and add at least one line item.",
        variant: "destructive",
      });
      return;
    }
    const { total } = calculateTotals();
    setIsSaving(true);
    await onSave(entry.engagement.id, total);
    setIsSaving(false);
  };
  
  const handleCreateNewSalesItem = (itemName: string) => {
    setItemToEdit({ name: itemName });
    setIsSalesItemDialogOpen(true);
  }

  const handleLineItemChange = (index: number, field: keyof LineItem, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // If sales item changed, update defaults
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
        taxRateId: taxRates.find(t => t.isDefault)?.id || '',
        sacCodeId: hsnSacCodes.find(h => h.isDefault)?.id || ''
      }]);
  }
  
  const removeLineItem = (index: number) => {
      setLineItems(lineItems.filter((_, i) => i !== index));
  }
  
  const calculateTotals = () => {
      let subTotal = 0;
      let cgst = 0;
      let sgst = 0;
      
      const selectedFirm = firms.find(f => f.id === selectedFirmId);
      const firmHasGst = !!selectedFirm?.gstn;

      lineItems.forEach(item => {
          const amount = item.quantity * item.rate;
          subTotal += amount;
          
          if (firmHasGst) {
              const tax = taxRates.find(t => t.id === item.taxRateId);
              if (tax && tax.rate > 0) {
                  const taxAmount = amount * (tax.rate / 100);
                  cgst += taxAmount / 2;
                  sgst += taxAmount / 2;
              }
          }
      });
      
      const total = subTotal + cgst + sgst;
      return { subTotal, cgst, sgst, total };
  }
  
  const { subTotal, cgst, sgst, total } = calculateTotals();

  if (!entry) return null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Generate Invoice for {entry.client.name}</DialogTitle>
          <DialogDescription>
            Construct the invoice by adding line items. All calculations are handled automatically.
          </DialogDescription>
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
                            <TableHead className="w-2/5">Item</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Rate</TableHead>
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
                                <TableCell>
                                     <Select value={item.taxRateId} onValueChange={(value) => handleLineItemChange(index, 'taxRateId', value)}>
                                        <SelectTrigger className="w-[120px]"><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            {taxRates.map(tr => <SelectItem key={tr.id} value={tr.id}>{tr.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell className="text-right font-mono">{(item.quantity * item.rate).toFixed(2)}</TableCell>
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
            Save & Mark as Billed
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

    