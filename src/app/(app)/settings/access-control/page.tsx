
"use client";

import * as React from "react";
import { collection, onSnapshot, doc, writeBatch, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Department, Permission, FeatureName } from "@/lib/data";
import { ALL_FEATURES } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

export default function AccessControlPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [departments, setDepartments] = React.useState<Department[]>([]);
    const [permissions, setPermissions] = React.useState<Map<FeatureName, string[]>>(new Map());
    const [initialPermissions, setInitialPermissions] = React.useState<Map<FeatureName, string[]>>(new Map());
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    
    const isAdmin = user?.email === 'ca.tonnyvarghese@gmail.com';

    React.useEffect(() => {
        const deptsUnsub = onSnapshot(collection(db, "departments"), (snapshot) => {
            const deptsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
            setDepartments(deptsData.sort((a,b) => a.order - b.order));
        });

        const permsUnsub = onSnapshot(collection(db, "permissions"), (snapshot) => {
            const permsMap = new Map<FeatureName, string[]>();
            ALL_FEATURES.forEach(feature => permsMap.set(feature.id, [])); // Initialize all features

            snapshot.docs.forEach(doc => {
                const data = doc.data() as Permission;
                if (permsMap.has(data.feature)) {
                    permsMap.set(data.feature, data.departments);
                }
            });
            setPermissions(permsMap);
            setInitialPermissions(new Map(JSON.parse(JSON.stringify(Array.from(permsMap))))); // Deep copy
            setLoading(false);
        });

        return () => {
            deptsUnsub();
            permsUnsub();
        };
    }, []);

    const handlePermissionChange = (feature: FeatureName, department: string, checked: boolean) => {
        setPermissions(prev => {
            const newPerms = new Map(prev);
            const currentDepartments = newPerms.get(feature) || [];
            if (checked) {
                if (!currentDepartments.includes(department)) {
                    newPerms.set(feature, [...currentDepartments, department]);
                }
            } else {
                newPerms.set(feature, currentDepartments.filter(d => d !== department));
            }
            return newPerms;
        });
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        try {
            const batch = writeBatch(db);
            const permissionsCollection = collection(db, "permissions");

            // First, delete all existing permissions to handle removals
            const existingDocs = await getDocs(permissionsCollection);
            existingDocs.forEach(d => batch.delete(d.ref));
            
            // Then, set the new permissions
            for (const [feature, departments] of permissions.entries()) {
                const docRef = doc(permissionsCollection, feature);
                batch.set(docRef, { feature, departments });
            }

            await batch.commit();
            toast({ title: "Success", description: "Permissions updated successfully." });
            setInitialPermissions(new Map(JSON.parse(JSON.stringify(Array.from(permissions))))); // Update initial state
        } catch (error) {
            console.error("Error saving permissions:", error);
            toast({ title: "Error", description: "Failed to save permissions.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };
    
    const hasChanges = JSON.stringify(Array.from(permissions)) !== JSON.stringify(Array.from(initialPermissions));


    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
     if (!isAdmin) {
        return (
            <Card>
                <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
                <CardContent><p>You do not have permission to manage access controls.</p></CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">Access Control Management</h2>
                    <p className="text-muted-foreground">
                        Assign feature permissions to different departments.
                    </p>
                </div>
                 <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/settings">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Settings
                        </Link>
                    </Button>
                    <Button onClick={handleSaveChanges} disabled={!hasChanges || saving}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Changes
                    </Button>
                </div>
            </div>
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[250px]">Feature</TableHead>
                                {departments.map(dept => (
                                    <TableHead key={dept.id} className="text-center">{dept.name}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ALL_FEATURES.map(feature => (
                                <TableRow key={feature.id}>
                                    <TableCell>
                                        <p className="font-medium">{feature.name}</p>
                                        <p className="text-xs text-muted-foreground">{feature.description}</p>
                                    </TableCell>
                                    {departments.map(dept => (
                                        <TableCell key={dept.id} className="text-center">
                                            <Checkbox
                                                checked={permissions.get(feature.id)?.includes(dept.name)}
                                                onCheckedChange={(checked) => handlePermissionChange(feature.id, dept.name, !!checked)}
                                                disabled={dept.name === 'Admin'} // Admins always have access
                                            />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
