
"use client";

import * as React from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Client, EngagementType, Employee, Department } from "@/lib/data";
import { Loader2, Download, UploadCloud } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BulkUpdateData } from "@/components/masters/bulk-update-data";
import { BulkCreateEngagements } from "@/components/employee/bulk-assign";
import { BulkCreateEmployees } from "@/components/employee/bulk-create-employees";

const ActionCard = ({ title, description, children }: { title: string, description: string, children: React.ReactNode }) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
                <UploadCloud className="h-6 w-6 text-primary"/>
                {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {children}
        </CardContent>
    </Card>
);

export default function BulkImportPage() {
    const [allEmployees, setAllEmployees] = React.useState<Employee[]>([]);
    const [allClients, setAllClients] = React.useState<Client[]>([]);
    const [allEngagementTypes, setAllEngagementTypes] = React.useState<EngagementType[]>([]);
    const [allDepartments, setAllDepartments] = React.useState<Department[]>([]);
    const [loading, setLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        setLoading(true);
        
        const fetchStaticData = async () => {
             try {
                const [clientsSnapshot, employeesSnapshot, engagementTypesSnapshot, departmentsSnapshot] = await Promise.all([
                    getDocs(collection(db, "clients")),
                    getDocs(collection(db, "employees")),
                    getDocs(collection(db, "engagementTypes")),
                    getDocs(collection(db, "departments")),
                ]);
                setAllClients(clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
                setAllEmployees(employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
                setAllEngagementTypes(engagementTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EngagementType)));
                setAllDepartments(departmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
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
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /> Loading Bulk Import Tools...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between space-y-2 mb-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">Bulk Data Import</h2>
                    <p className="text-muted-foreground">
                        Efficiently add or update data for clients, engagements, and employees using CSV files.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <ActionCard
                    title="Import Clients"
                    description="Add new clients or update existing ones. Records are matched by PAN or a combination of Name and Mobile Number."
                 >
                    <BulkUpdateData onBack={() => {}} />
                 </ActionCard>

                 <ActionCard
                    title="Import Engagements"
                    description="Create new work engagements in bulk for your clients and assign them to team members."
                 >
                    <BulkCreateEngagements
                        allEmployees={allEmployees}
                        allClients={allClients}
                        allEngagementTypes={allEngagementTypes}
                    />
                 </ActionCard>

                 <ActionCard
                    title="Import Employees"
                    description="Add new employees or update existing ones. Records are matched by email address."
                 >
                     <BulkCreateEmployees
                        allDepartments={allDepartments}
                    />
                 </ActionCard>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>How to Import Your Data</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-muted-foreground">
                    <div>
                        <h3 className="font-semibold text-foreground mb-2">For CSV Files:</h3>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>For each data type (Clients, Engagements, Employees), click **"Download Template"** to get the correct CSV file format.</li>
                            <li>Open the downloaded CSV file in a spreadsheet program (like Excel, Google Sheets, or Numbers).</li>
                            <li>Fill the template with your data. Ensure the column headers are not changed. Columns with an asterisk (*) are mandatory.</li>
                            <li>Save the file in CSV format.</li>
                            <li>Drag and drop the completed CSV file onto the corresponding "Upload" area on this page.</li>
                            <li>Follow the on-screen instructions to validate and import your data.</li>
                        </ol>
                    </div>
                     <div>
                        <h3 className="font-semibold text-foreground mb-2">For XML Files:</h3>
                        <p>The importer currently only supports the CSV format. You will need to convert your XML data into the corresponding CSV template format before you can upload it. Most spreadsheet programs can help you with this conversion.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
