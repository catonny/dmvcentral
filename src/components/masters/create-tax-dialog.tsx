
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
import { Checkbox } from "@/components/ui/checkbox";
import type { TaxRate } from "@/lib/data";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const taxRateSchema = z.object({
    name: z.string().min(1, "Name is required"),
    rate: z.coerce.number().min(0, "Rate must be a positive number"),
    isDefault: z.boolean().default(false),
});

type FormData = z.infer<typeof taxRateSchema>;

interface CreateTaxRateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<TaxRate, 'id'>, id?: string) => Promise<void>;
  taxRate?: TaxRate | null;
}

export function CreateTaxRateDialog({ isOpen, onClose, onSave, taxRate }: CreateTaxRateDialogProps) {
    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(taxRateSchema),
    });

    React.useEffect(() => {
        if (isOpen) {
            reset(taxRate || { name: "", rate: 0, isDefault: false });
        }
    }, [isOpen, taxRate, reset]);

    const handleSave = (data: FormData) => {
        onSave(data, taxRate?.id);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{taxRate ? "Edit" : "Create"} Tax Rate</DialogTitle>
                    <DialogDescription>
                        {taxRate ? "Update the details for this tax rate." : "Add a new tax rate for your invoices."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Tax Rate Name</Label>
                        <Input id="name" {...register("name")} placeholder="e.g., GST @ 18%" />
                        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="rate">Rate (%)</Label>
                        <Input id="rate" type="number" {...register("rate")} />
                        {errors.rate && <p className="text-sm text-destructive">{errors.rate.message}</p>}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Controller
                            name="isDefault"
                            control={control}
                            render={({ field }) => (
                                <Checkbox id="isDefault" checked={field.value} onCheckedChange={field.onChange} />
                            )}
                        />
                        <Label htmlFor="isDefault">Set as default tax rate</Label>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

