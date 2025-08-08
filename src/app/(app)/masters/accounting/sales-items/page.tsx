
"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import type { SalesItem } from "@/lib/data";

export default function SalesItemsPage() {
    const router = useRouter();
    const [salesItems, setSalesItems] = React.useState<SalesItem[]>([]);
    const [loading, setLoading] = React.useState(true);
    
    React.useEffect(() => {
        const unsub = onSnapshot(collection(db, "salesItems"), (snapshot) => {
            setSalesItems(snapshot.docs.map(doc => doc.data() as SalesItem));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    return (
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
                 <Button onClick={() => { /* Open dialog */ }}>
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
                        <div>Coming Soon: Table of sales items will be displayed here.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
