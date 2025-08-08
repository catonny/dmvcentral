
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast";
import type { Firm } from "@/lib/data";
import { indianStatesAndUTs, countries } from "@/lib/data";
import { ScrollArea } from "../ui/scroll-area";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";


const firmSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Firm name is required"),
  pan: z.string().optional(),
  gstn: z.string().optional(),
  pfCode: z.string().optional(),
  esiCode: z.string().optional(),
  website: z.string().url("Must be a valid URL").optional().or(z.literal('')),
  email: z.string().email("Must be a valid email").optional().or(z.literal('')),
  contactNumber: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfscCode: z.string().optional(),
  billingAddressLine1: z.string().optional(),
  billingAddressLine2: z.string().optional(),
  billingAddressLine3: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
});

type FirmFormData = z.infer<typeof firmSchema>;

interface EditFirmSheetProps {
    firm: Firm | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (firmData: FirmFormData) => Promise<void>;
}

export function EditFirmSheet({ firm, isOpen, onSave, onClose }: EditFirmSheetProps) {
    const { toast } = useToast();
    const {
        register,
        handleSubmit,
        control,
        reset,
        watch,
        formState: { errors },
      } = useForm<FirmFormData>({
        resolver: zodResolver(firmSchema),
      });

    React.useEffect(() => {
        if (isOpen) {
            reset(firm || {
                name: "",
                pan: "",
                country: "India",
            });
        }
    }, [firm, isOpen, reset]);

    const handleFormSubmit = async (data: FirmFormData) => {
        await onSave(data);
    };
    
    const country = watch("country");

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="sm:max-w-xl">
                <SheetHeader>
                    <SheetTitle>{firm ? 'Edit Firm Profile' : 'Add New Firm'}</SheetTitle>
                    <SheetDescription>
                        {firm ? "Update the firm's details below." : "Enter the details for the new firm."}
                    </SheetDescription>
                </SheetHeader>
                <form onSubmit={handleSubmit(handleFormSubmit)}>
                <ScrollArea className="h-[calc(100vh-12rem)] pr-6">
                <div className="grid gap-4 py-4">
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name*</Label>
                        <div className="col-span-3">
                            <Input id="name" {...register("name")} />
                            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
                        </div>
                    </div>
                    
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="pan" className="text-right">PAN</Label>
                         <div className="col-span-3">
                            <Input id="pan" {...register("pan")} />
                            {errors.pan && <p className="text-sm text-destructive mt-1">{errors.pan.message}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="gstn" className="text-right">GSTN</Label>
                        <Input id="gstn" {...register("gstn")} className="col-span-3" />
                    </div>
                    
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="website" className="text-right">Website</Label>
                         <div className="col-span-3">
                            <Input id="website" {...register("website")} />
                             {errors.website && <p className="text-sm text-destructive mt-1">{errors.website.message}</p>}
                        </div>
                    </div>

                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">Email</Label>
                         <div className="col-span-3">
                            <Input id="email" {...register("email")} />
                            {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
                        </div>
                    </div>

                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="contactNumber" className="text-right">Contact No.</Label>
                        <Input id="contactNumber" {...register("contactNumber")} className="col-span-3" />
                    </div>

                    <h4 className="font-semibold text-foreground border-t pt-4 mt-2 col-span-full">Compliance</h4>

                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="pfCode" className="text-right">PF Code</Label>
                        <Input id="pfCode" {...register("pfCode")} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="esiCode" className="text-right">ESI Code</Label>
                        <Input id="esiCode" {...register("esiCode")} className="col-span-3" />
                    </div>

                     <h4 className="font-semibold text-foreground border-t pt-4 mt-2 col-span-full">Bank Details</h4>

                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="bankAccountName" className="text-right">Account Name</Label>
                        <Input id="bankAccountName" {...register("bankAccountName")} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="bankAccountNumber" className="text-right">Account Number</Label>
                        <Input id="bankAccountNumber" {...register("bankAccountNumber")} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="bankIfscCode" className="text-right">IFSC Code</Label>
                        <Input id="bankIfscCode" {...register("bankIfscCode")} className="col-span-3" />
                    </div>
                    
                     <h4 className="font-semibold text-foreground border-t pt-4 mt-2 col-span-full">Address</h4>

                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="billingAddressLine1" className="text-right">Address 1</Label>
                        <Input id="billingAddressLine1" {...register("billingAddressLine1")} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="billingAddressLine2" className="text-right">Address 2</Label>
                        <Input id="billingAddressLine2" {...register("billingAddressLine2")} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="billingAddressLine3" className="text-right">Address 3</Label>
                        <Input id="billingAddressLine3" {...register("billingAddressLine3")} className="col-span-3" />
                    </div>

                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="country" className="text-right">Country</Label>
                        <Controller
                            name="country"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Select country" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {countries.map((c) => (
                                            <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="state" className="text-right">State</Label>
                        <div className="col-span-3">
                            {country === 'India' ? (
                                 <Controller
                                    name="state"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select state" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {indianStatesAndUTs.map((s) => (
                                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            ) : (
                                <Input id="state" {...register("state")} />
                            )}
                        </div>
                    </div>
                </div>
                </ScrollArea>
                <SheetFooter className="pt-4 border-t">
                    <SheetClose asChild>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    </SheetClose>
                    <Button type="submit">Save changes</Button>
                </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    )
}
