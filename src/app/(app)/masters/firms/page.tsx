
"use client";

import * as React from "react";
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Firm } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, MoreHorizontal, Edit, Trash2, PlusCircle } from "lucide-react";
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
import { EditFirmSheet } from "@/components/masters/edit-firm-sheet";
import { useRouter } from "next/navigation";


export default function FirmsPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [firms, setFirms] = React.useState<Firm[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);
    const [selectedFirm, setSelectedFirm] = React.useState<Firm | null>(null);
    const [firmToDelete, setFirmToDelete] = React.useState<Firm | null>(null);

    React.useEffect(() => {
        const firmsUnsub = onSnapshot(collection(db, "firms"), (snapshot) => {
            const firmsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Firm));
            setFirms(firmsData);
            setLoading(false);
        });

        return () => firmsUnsub();
    }, []);

    const handleOpenSheet = (firm: Firm | null) => {
        setSelectedFirm(firm);
        setIsSheetOpen(true);
    };

    const handleCloseSheet = () => {
        setIsSheetOpen(false);
        setSelectedFirm(null);
    };

    const handleSaveFirm = async (firmData: Partial<Firm>) => {
        try {
            // Clean the data to remove undefined values
            const cleanData = Object.entries(firmData).reduce((acc, [key, value]) => {
                if (value !== undefined) {
                    acc[key as keyof Firm] = value;
                }
                return acc;
            }, {} as Partial<Firm>);


            if (cleanData.id) {
                const firmRef = doc(db, "firms", cleanData.id);
                const { id, ...dataToUpdate } = cleanData;
                await updateDoc(firmRef, dataToUpdate);
                toast({ title: "Success", description: "Firm details updated." });
            } else {
                const docRef = await addDoc(collection(db, "firms"), cleanData);
                await updateDoc(docRef, {id: docRef.id});
                toast({ title: "Success", description: "New firm added." });
            }
            handleCloseSheet();
        } catch (error) {
            console.error("Error saving firm:", error);
            toast({ title: "Error", description: "Failed to save firm details.", variant: "destructive" });
        }
    };
    
    const handleDeleteFirm = async () => {
        if (!firmToDelete) return;
        // In a real app, you would check if any clients are linked to this firm before deleting.
        try {
            await deleteDoc(doc(db, "firms", firmToDelete.id));
            toast({ title: "Success", description: "Firm deleted." });
        } catch (error) {
            console.error("Error deleting firm:", error);
            toast({ title: "Error", description: "Failed to delete firm.", variant: "destructive" });
        } finally {
            setFirmToDelete(null);
        }
    }


    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
             <Button variant="outline" size="sm" onClick={() => router.push('/masters')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Masters
            </Button>
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">Manage Firms</h2>
                    <p className="text-muted-foreground">
                        View, create, or edit your firm profiles.
                    </p>
                </div>
                 <Button onClick={() => handleOpenSheet(null)}>
                    <PlusCircle className="mr-2"/>
                    Add New Firm
                </Button>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {firms.map(firm => (
                    <Card key={firm.id}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle>{firm.name}</CardTitle>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <MoreHorizontal />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleOpenSheet(firm)}>
                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setFirmToDelete(firm)} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <CardDescription>{firm.website || "No website listed"}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <p><strong>PAN:</strong> {firm.pan}</p>
                                <p><strong>GSTN:</strong> {firm.gstn || "N/A"}</p>
                                <p><strong>Email:</strong> {firm.email || "N/A"}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <EditFirmSheet
                isOpen={isSheetOpen}
                onClose={handleCloseSheet}
                onSave={handleSaveFirm}
                firm={selectedFirm}
            />

            <AlertDialog open={!!firmToDelete} onOpenChange={(open) => !open && setFirmToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the firm <strong>{firmToDelete?.name}</strong>. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteFirm} className="bg-destructive hover:bg-destructive/90">
                            Delete Firm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
