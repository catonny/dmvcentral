

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SalesItem, TaxRate, HsnSacCode, EngagementType } from "@/lib/data";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, updateDoc, collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

const salesItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  description: z.string().min(1, "Description is required"),
  standardPrice: z.coerce.number().min(0, "Price must be a positive number"),
  defaultTaxRateId: z.string().min(1, "Default tax rate is required"),
  defaultSacId: z.string().min(1, "Default SAC/HSN code is required"),
  associatedEngagementTypeId: z.string().optional(),
});

type FormData = z.infer<typeof salesItemSchema>;

interface EditSalesItemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  salesItem: Partial<SalesItem> | null;
  taxRates: TaxRate[];
  hsnSacCodes: HsnSacCode[];
}

export function EditSalesItemDialog({
  isOpen,
  onClose,
  salesItem,
  taxRates,
  hsnSacCodes,
}: EditSalesItemDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(false);
    const [engagementTypes, setEngagementTypes] = React.useState<EngagementType[]>([]);

    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(salesItemSchema),
    });

    React.useEffect(() => {
        const unsub = onSnapshot(collection(db, "engagementTypes"), (snapshot) => {
            setEngagementTypes(snapshot.docs.map(doc => doc.data() as EngagementType));
        });
        return () => unsub();
    }, []);

    React.useEffect(() => {
        if (isOpen) {
            if (salesItem) {
                const defaultValues = {
                    name: salesItem.name || "",
                    description: salesItem.description || "",
                    standardPrice: salesItem.standardPrice || 0,
                    defaultTaxRateId: salesItem.defaultTaxRateId || taxRates.find(t => t.isDefault)?.id || "",
                    defaultSacId: salesItem.defaultSacId || hsnSacCodes.find(h => h.isDefault)?.id || "",
                    associatedEngagementTypeId: salesItem.associatedEngagementTypeId || "",
                };
                reset(defaultValues);
            } else {
                 const defaultTax = taxRates.find(t => t.isDefault);
                 const defaultHsn = hsnSacCodes.find(h => h.isDefault);
                 reset({
                    name: "",
                    description: "",
                    standardPrice: 0,
                    defaultTaxRateId: defaultTax?.id || "",
                    defaultSacId: defaultHsn?.id || "",
                    associatedEngagementTypeId: "",
                });
            }
        }
    }, [isOpen, salesItem, taxRates, hsnSacCodes, reset]);

    const handleSave = async (data: FormData) => {
        setIsLoading(true);
        try {
            const dataToSave = { ...data, associatedEngagementTypeId: data.associatedEngagementTypeId || null };
            if (salesItem?.id) {
                // Update existing
                const docRef = doc(db, "salesItems", salesItem.id);
                await updateDoc(docRef, dataToSave);
                toast({ title: "Success", description: "Sales item updated." });
            } else {
                // Create new
                const docRef = doc(collection(db, "salesItems"));
                await setDoc(docRef, { ...dataToSave, id: docRef.id });
                toast({ title: "Success", description: "New sales item created." });
            }
            onClose();
        } catch (error) {
            console.error("Error saving sales item:", error);
            toast({ title: "Error", description: "Failed to save sales item.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{salesItem?.id ? "Edit" : "Create"} Sales Item</DialogTitle>
          <DialogDescription>
            {salesItem?.id ? "Update the details for this line item." : "Add a new reusable line item for your invoices."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">Item Name</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" {...register("description")} />
                 {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="standardPrice">Standard Price (INR)</Label>
                    <Input id="standardPrice" type="number" {...register("standardPrice")} />
                     {errors.standardPrice && <p className="text-sm text-destructive">{errors.standardPrice.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label>Default Tax Rate</Label>
                    <Controller
                        name="defaultTaxRateId"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select tax rate..."/></SelectTrigger>
                                <SelectContent>
                                    {taxRates.map(rate => <SelectItem key={rate.id} value={rate.id}>{rate.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.defaultTaxRateId && <p className="text-sm text-destructive">{errors.defaultTaxRateId.message}</p>}
                </div>
            </div>
             <div className="space-y-2">
                <Label>Default HSN/SAC Code</Label>
                 <Controller
                    name="defaultSacId"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Select HSN/SAC code..."/></SelectTrigger>
                            <SelectContent>
                                {hsnSacCodes.map(code => <SelectItem key={code.id} value={code.id}>{code.code} - {code.description}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                />
                 {errors.defaultSacId && <p className="text-sm text-destructive">{errors.defaultSacId.message}</p>}
            </div>
             <div className="space-y-2">
                <Label>Associated Engagement Type</Label>
                 <Controller
                    name="associatedEngagementTypeId"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Select an engagement type..."/></SelectTrigger>
                            <SelectContent>
                                 <SelectItem value="">None</SelectItem>
                                {engagementTypes.map(type => <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
             <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Save
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
