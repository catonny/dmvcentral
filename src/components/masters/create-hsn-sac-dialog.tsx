
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { HsnSacCode } from "@/lib/data";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const hsnSacSchema = z.object({
    code: z.string().min(1, "Code is required"),
    description: z.string().min(1, "Description is required"),
    type: z.enum(["HSN", "SAC"]),
    isDefault: z.boolean().default(false),
});

type FormData = z.infer<typeof hsnSacSchema>;

interface CreateHsnSacDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<HsnSacCode, 'id'>, id?: string) => Promise<void>;
  hsnSacCode?: HsnSacCode | null;
}

export function CreateHsnSacDialog({ isOpen, onClose, onSave, hsnSacCode }: CreateHsnSacDialogProps) {
    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormData>({
        resolver: zodResolver(hsnSacSchema),
    });

    React.useEffect(() => {
        if (isOpen) {
            reset(hsnSacCode || { code: "", description: "", type: "SAC", isDefault: false });
        }
    }, [isOpen, hsnSacCode, reset]);

    const handleSave = (data: FormData) => {
        onSave(data, hsnSacCode?.id);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{hsnSacCode ? "Edit" : "Create"} HSN/SAC Code</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="code">Code</Label>
                        <Input id="code" {...register("code")} />
                        {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input id="description" {...register("description")} />
                        {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label>Type</Label>
                        <Controller
                            name="type"
                            control={control}
                            render={({ field }) => (
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="HSN" id="hsn" />
                                        <Label htmlFor="hsn">HSN (Goods)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="SAC" id="sac" />
                                        <Label htmlFor="sac">SAC (Services)</Label>
                                    </div>
                                </RadioGroup>
                            )}
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Controller
                            name="isDefault"
                            control={control}
                            render={({ field }) => (
                                <Checkbox id="isDefault" checked={field.value} onCheckedChange={field.onChange} />
                            )}
                        />
                        <Label htmlFor="isDefault">Set as default code</Label>
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
