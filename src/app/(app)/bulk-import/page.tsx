
"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkUpdateData } from "@/components/masters/bulk-update-data";
import { BulkCreateEngagements } from "@/components/employee/bulk-assign";
import { collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Client, Engagement, EngagementType, Employee } from "@/lib/data";

export default function BulkImportPage() {
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
    const [allClients, setAllClients] = React.useState<Client[]>([]);
    const [allEngagementTypes, setAllEngagementTypes] = React.useState<EngagementType[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        setLoading(true);
        
        const fetchStaticData = async () => {
             try {
                const [clientsSnapshot, employeesSnapshot, engagementTypesSnapshot] = await Promise.all([
                getDocs(collection(db, "clients")),
                getDocs(collection(db, "employees")),
                getDocs(collection(db, "engagementTypes"))
                ]);
                setAllClients(clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
                setAllEmployees(employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
                setAllEngagementTypes(engagementTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EngagementType)));
            } catch (error) {
                console.error("Error fetching static data for Bulk Import:", error);
                toast({
                title: "Error",
                description: "Could not load necessary master data.",
                variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        }
        fetchStaticData();

    }, [toast]);

    if (loading) {
        return <div className="flex h-full w-full items-center justify-center">Loading Bulk Import Tools...</div>;
    }


  return (
    <>
      <div className="flex items-center justify-between space-y-2 mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Bulk Import</h2>
          <p className="text-muted-foreground">
            Efficiently add or update data using CSV files.
          </p>
        </div>
      </div>
       <Tabs defaultValue="bulk-client-update" className="space-y-4">
        <TabsList>
          <TabsTrigger value="bulk-client-update">Bulk Update Clients</TabsTrigger>
          <TabsTrigger value="bulk-engagements">Bulk Create Engagements</TabsTrigger>
        </TabsList>
        <TabsContent value="bulk-client-update">
            {/* Pass onBack as a dummy function as it's not needed here */}
            <BulkUpdateData onBack={() => {}} />
        </TabsContent>
        <TabsContent value="bulk-engagements">
            <BulkCreateEngagements
                allEmployees={allEmployees}
                allClients={allClients}
                allEngagementTypes={allEngagementTypes}
            />
        </TabsContent>
      </Tabs>
    </>
  );
}
