
"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import type { TaxRate, HsnSacCode } from "@/lib/data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { CreateTaxRateDialog } from "@/components/masters/create-tax-dialog";
import { CreateHsnSacDialog } from "@/components/masters/create-hsn-sac-dialog";

export default function TaxesPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [taxRates, setTaxRates] = React.useState<TaxRate[]>([]);
    const [hsnSacCodes, setHsnSacCodes] = React.useState<HsnSacCode[]>([]);
    const [loadingRates, setLoadingRates] = React.useState(true);
    const [loadingCodes, setLoadingCodes] = React.useState(true);
    
    // State for dialogs
    const [isTaxRateDialogOpen, setIsTaxRateDialogOpen] = React.useState(false);
    const [isHsnSacDialogOpen, setIsHsnSacDialogOpen] = React.useState(false);
    const [selectedTaxRate, setSelectedTaxRate] = React.useState<TaxRate | null>(null);
    const [selectedHsnSac, setSelectedHsnSac] = React.useState<HsnSacCode | null>(null);
    
    React.useEffect(() => {
        const ratesUnsub = onSnapshot(query(collection(db, "taxRates"), orderBy("rate")), (snapshot) => {
            setTaxRates(snapshot.docs.map(doc => doc.data() as TaxRate));
            setLoadingRates(false);
        });
        const codesUnsub = onSnapshot(query(collection(db, "hsnSacCodes"), orderBy("code")), (snapshot) => {
            setHsnSacCodes(snapshot.docs.map(doc => doc.data() as HsnSacCode));
            setLoadingCodes(false);
        });
        return () => {
            ratesUnsub();
            codesUnsub();
        };
    }, []);

    const handleSaveTaxRate = async (data: Omit<TaxRate, 'id'>, id?: string) => {
        try {
            if (id) {
                await updateDoc(doc(db, "taxRates", id), data);
                toast({ title: "Success", description: "Tax rate updated." });
            } else {
                const newDocRef = doc(collection(db, "taxRates"));
                await setDoc(newDocRef, { ...data, id: newDocRef.id });
                toast({ title: "Success", description: "New tax rate created." });
            }
            setIsTaxRateDialogOpen(false);
        } catch (error) {
            console.error("Error saving tax rate:", error);
            toast({ title: "Error", description: "Failed to save tax rate.", variant: "destructive"});
        }
    };
    
    const handleSaveHsnSacCode = async (data: Omit<HsnSacCode, 'id'>, id?: string) => {
        try {
            if (id) {
                await updateDoc(doc(db, "hsnSacCodes", id), data);
                toast({ title: "Success", description: "HSN/SAC code updated." });
            } else {
                const newDocRef = doc(collection(db, "hsnSacCodes"));
                await setDoc(newDocRef, { ...data, id: newDocRef.id });
                toast({ title: "Success", description: "New HSN/SAC code created." });
            }
            setIsHsnSacDialogOpen(false);
        } catch (error) {
            console.error("Error saving HSN/SAC code:", error);
            toast({ title: "Error", description: "Failed to save HSN/SAC code.", variant: "destructive"});
        }
    };


    return (
        <>
            <div className="space-y-6">
                <Button variant="outline" size="sm" onClick={() => router.push('/masters/accounting')} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Accounting Masters
                </Button>
                <Card>
                    <CardHeader>
                        <CardTitle>Tax Management</CardTitle>
                        <CardDescription>Manage tax rates and HSN/SAC codes for your invoices.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="rates">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="rates">Tax Rates</TabsTrigger>
                                <TabsTrigger value="codes">HSN/SAC Codes</TabsTrigger>
                            </TabsList>
                            <TabsContent value="rates" className="mt-4">
                                <div className="flex justify-end mb-4">
                                    <Button onClick={() => { setSelectedTaxRate(null); setIsTaxRateDialogOpen(true); }}>
                                        <PlusCircle className="mr-2"/>
                                        Add New Tax Rate
                                    </Button>
                                </div>
                            {loadingRates ? (
                                    <div className="flex h-48 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
                            ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Rate Name</TableHead>
                                                <TableHead>Percentage</TableHead>
                                                <TableHead>Default</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {taxRates.map(rate => (
                                                <TableRow key={rate.id} onClick={() => { setSelectedTaxRate(rate); setIsTaxRateDialogOpen(true); }} className="cursor-pointer">
                                                    <TableCell>{rate.name}</TableCell>
                                                    <TableCell>{rate.rate}%</TableCell>
                                                    <TableCell><Checkbox checked={rate.isDefault} /></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                            )}
                            </TabsContent>
                            <TabsContent value="codes" className="mt-4">
                                <div className="flex justify-end mb-4">
                                    <Button onClick={() => { setSelectedHsnSac(null); setIsHsnSacDialogOpen(true); }}>
                                        <PlusCircle className="mr-2"/>
                                        Add New HSN/SAC
                                    </Button>
                                </div>
                                {loadingCodes ? (
                                    <div className="flex h-48 w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
                            ) : (
                                <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Code</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Default</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {hsnSacCodes.map(code => (
                                                <TableRow key={code.id} onClick={() => { setSelectedHsnSac(code); setIsHsnSacDialogOpen(true); }} className="cursor-pointer">
                                                    <TableCell>{code.code}</TableCell>
                                                    <TableCell>{code.description}</TableCell>
                                                    <TableCell>{code.type}</TableCell>
                                                    <TableCell><Checkbox checked={code.isDefault} /></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                            )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
            
            <CreateTaxRateDialog
                isOpen={isTaxRateDialogOpen}
                onClose={() => setIsTaxRateDialogOpen(false)}
                onSave={handleSaveTaxRate}
                taxRate={selectedTaxRate}
            />
            
            <CreateHsnSacDialog
                isOpen={isHsnSacDialogOpen}
                onClose={() => setIsHsnSacDialogOpen(false)}
                onSave={handleSaveHsnSacCode}
                hsnSacCode={selectedHsnSac}
            />
        </>
    );
}

