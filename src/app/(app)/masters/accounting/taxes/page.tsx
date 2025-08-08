
"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import type { TaxRate, HsnSacCode } from "@/lib/data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

export default function TaxesPage() {
    const router = useRouter();
    const [taxRates, setTaxRates] = React.useState<TaxRate[]>([]);
    const [hsnSacCodes, setHsnSacCodes] = React.useState<HsnSacCode[]>([]);
    const [loadingRates, setLoadingRates] = React.useState(true);
    const [loadingCodes, setLoadingCodes] = React.useState(true);
    
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

    return (
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
                                <Button>
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
                                            <TableRow key={rate.id}>
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
                                <Button>
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
                                            <TableRow key={code.id}>
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
    );
}

