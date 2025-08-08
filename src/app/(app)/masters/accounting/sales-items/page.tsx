
"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, MoreHorizontal, PlusCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { collection, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import type { SalesItem, TaxRate, HsnSacCode } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { EditSalesItemDialog } from "@/components/masters/edit-sales-item-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SalesItemsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [salesItems, setSalesItems] = React.useState<SalesItem[]>([]);
    const [taxRates, setTaxRates] = React.useState<TaxRate[]>([]);
    const [hsnSacCodes, setHsnSacCodes] = React.useState<HsnSacCode[]>([]);
    const [loading, setLoading] = React.useState(true);
    
    // Dialog/Sheet State
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [selectedItem, setSelectedItem] = React.useState<SalesItem | null>(null);
    const [itemToDelete, setItemToDelete] = React.useState<SalesItem | null>(null);
    
    React.useEffect(() => {
        const unsubSales = onSnapshot(collection(db, "salesItems"), (snapshot) => {
            setSalesItems(snapshot.docs.map(doc => doc.data() as SalesItem));
            setLoading(false);
        });
         const unsubTax = onSnapshot(collection(db, "taxRates"), (snapshot) => {
            setTaxRates(snapshot.docs.map(doc => doc.data() as TaxRate));
        });
         const unsubHsn = onSnapshot(collection(db, "hsnSacCodes"), (snapshot) => {
            setHsnSacCodes(snapshot.docs.map(doc => doc.data() as HsnSacCode));
        });

        return () => {
            unsubSales();
            unsubTax();
            unsubHsn();
        };
    }, []);

    const handleOpenDialog = (item: SalesItem | null) => {
        setSelectedItem(item);
        setIsDialogOpen(true);
    };

    const handleDeleteItem = async () => {
        if (!itemToDelete) return;
        try {
            await deleteDoc(doc(db, "salesItems", itemToDelete.id));
            toast({ title: "Success", description: "Sales item deleted." });
        } catch (error) {
            console.error("Error deleting sales item:", error);
            toast({ title: "Error", description: "Failed to delete item.", variant: "destructive"});
        } finally {
            setItemToDelete(null);
        }
    };

    return (
        <>
        <div className="space-y-6">
            <Button variant="outline" size="sm" onClick={() => router.push('/masters/accounting')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Accounting Masters
            </Button>
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">Sales Items</h2>
                    <p className="text-muted-foreground">
                        Manage reusable line items for invoices.
                    </p>
                </div>
                 <Button onClick={() => handleOpenDialog(null)}>
                    <PlusCircle className="mr-2"/>
                    Add New Sales Item
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>All Sales Items</CardTitle>
                    <CardDescription>View and manage all your firm's sales line items.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                         <div className="flex h-48 w-full items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Standard Price (INR)</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salesItems.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell className="max-w-sm truncate">{item.description}</TableCell>
                                        <TableCell className="text-right font-mono">₹{item.standardPrice.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleOpenDialog(item)}>
                                                        <Edit className="mr-2 h-4 w-4"/> Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setItemToDelete(item)} className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
        <EditSalesItemDialog
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            salesItem={selectedItem}
            taxRates={taxRates}
            hsnSacCodes={hsnSacCodes}
        />
        <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the sales item <strong>{itemToDelete?.name}</strong>. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
