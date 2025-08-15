
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, Edit, Loader2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Expense } from "@/lib/data";

const expenseSchema = z.object({
    name: z.string().min(1, "Expense name is required."),
    type: z.enum(["Monthly", "Annual"], { required_error: "Expense type is required." }),
    amount: z.coerce.number().min(1, "Amount must be greater than 0."),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface ExpenseManagerProps {
    initialExpenses: Expense[];
}

export function ExpenseManager({ initialExpenses }: ExpenseManagerProps) {
    const [expenses, setExpenses] = React.useState<Expense[]>(initialExpenses);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingExpense, setEditingExpense] = React.useState<Expense | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const unsub = onSnapshot(collection(db, "expenses"), (snapshot) => {
            setExpenses(snapshot.docs.map(doc => doc.data() as Expense));
        });
        return () => unsub();
    }, []);

    const handleOpenDialog = (expense: Expense | null = null) => {
        setEditingExpense(expense);
        setIsDialogOpen(true);
    };

    const handleDelete = async (expenseId: string) => {
        await deleteDoc(doc(db, "expenses", expenseId));
        toast({ title: "Success", description: "Expense deleted." });
    };

    const monthlyTotal = expenses.filter(e => e.type === 'Monthly').reduce((sum, e) => sum + e.amount, 0);
    const annualTotal = expenses.filter(e => e.type === 'Annual').reduce((sum, e) => sum + e.amount, 0);
    const monthlyEquivalent = monthlyTotal + (annualTotal / 12);

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle>Expense Management</CardTitle>
                        <CardDescription>Define your firm's recurring costs.</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => handleOpenDialog()}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Expense
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Expense</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Amount (INR)</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expenses.length > 0 ? (
                                expenses.map(expense => (
                                    <TableRow key={expense.id}>
                                        <TableCell className="font-medium">{expense.name}</TableCell>
                                        <TableCell>{expense.type}</TableCell>
                                        <TableCell className="text-right font-mono">{expense.amount.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(expense)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(expense.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">No expenses defined yet.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <div className="mt-4 pt-4 border-t text-right">
                        <p className="text-sm text-muted-foreground">Monthly Total: <span className="font-semibold text-foreground font-mono">₹{monthlyTotal.toLocaleString()}</span></p>
                        <p className="text-sm text-muted-foreground">Annual Total: <span className="font-semibold text-foreground font-mono">₹{annualTotal.toLocaleString()}</span></p>
                        <p className="text-lg font-bold mt-2">Monthly Equivalent Budget: <span className="font-mono text-primary">₹{monthlyEquivalent.toLocaleString(undefined, {maximumFractionDigits: 0})}</span></p>
                    </div>
                </CardContent>
            </Card>
            <ExpenseDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                expense={editingExpense}
            />
        </>
    );
}

function ExpenseDialog({ isOpen, onClose, expense }: { isOpen: boolean; onClose: () => void; expense: Expense | null; }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);
    const { register, handleSubmit, control, reset, formState: { errors } } = useForm<ExpenseFormData>({
        resolver: zodResolver(expenseSchema),
    });

    React.useEffect(() => {
        if (isOpen) {
            if (expense) {
                reset({ name: expense.name, type: expense.type, amount: expense.amount });
            } else {
                reset({ name: "", type: "Monthly", amount: 0 });
            }
        }
    }, [isOpen, expense, reset]);

    const handleSave = async (data: ExpenseFormData) => {
        setIsSaving(true);
        try {
            if (expense?.id) {
                await updateDoc(doc(db, "expenses", expense.id), data);
                toast({ title: "Success", description: "Expense updated." });
            } else {
                const docRef = doc(collection(db, "expenses"));
                await setDoc(docRef, { ...data, id: docRef.id });
                toast({ title: "Success", description: "New expense added." });
            }
            onClose();
        } catch (error) {
            toast({ title: "Error", description: "Failed to save expense.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{expense ? "Edit Expense" : "Add New Expense"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="name">Expense Name</Label>
                        <Input id="name" {...register("name")} />
                        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="type">Type</Label>
                        <Controller name="type" control={control} render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Monthly">Monthly</SelectItem>
                                    <SelectItem value="Annual">Annual</SelectItem>
                                </SelectContent>
                            </Select>
                        )} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="amount">Amount (INR)</Label>
                        <Input id="amount" type="number" {...register("amount")} />
                        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
