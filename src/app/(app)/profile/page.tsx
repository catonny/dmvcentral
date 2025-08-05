
"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import type { Employee } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export default function ProfilePage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [employeeProfile, setEmployeeProfile] = React.useState<Employee | null>(null);
    const [employeeDocId, setEmployeeDocId] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    React.useEffect(() => {
        if (!user) return;
        setLoading(true);

        const fetchProfile = async () => {
            try {
                const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
                const snapshot = await getDocs(employeeQuery);
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    setEmployeeProfile({ id: doc.id, ...doc.data() } as Employee);
                    setEmployeeDocId(doc.id);
                }
            } catch (error) {
                console.error("Error fetching employee profile: ", error);
                toast({ title: "Error", description: "Could not load your profile.", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [user, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!employeeProfile) return;
        const { id, value } = e.target;
        setEmployeeProfile({ ...employeeProfile, [id]: value });
    };

    const handleSave = async () => {
        if (!employeeDocId || !employeeProfile) return;
        setSaving(true);
        try {
            const employeeRef = doc(db, "employees", employeeDocId);
            const { id, role, email, ...dataToSave } = employeeProfile; // Exclude fields that shouldn't be edited here
            await updateDoc(employeeRef, dataToSave);
            toast({ title: "Success", description: "Your profile has been updated." });
        } catch (error) {
            console.error("Error updating profile:", error);
            toast({ title: "Error", description: "Failed to update your profile.", variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    if (loading || authLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!employeeProfile) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Profile Not Found</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>We could not find an employee profile associated with your account.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">My Profile</h2>
                    <p className="text-muted-foreground">
                        View and edit your personal information.
                    </p>
                </div>
                 <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Changes
                </Button>
            </div>
            <Card>
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="flex flex-col items-center gap-4">
                            <Avatar className="h-32 w-32">
                                <AvatarImage src={employeeProfile.avatar} alt={employeeProfile.name} />
                                <AvatarFallback>{employeeProfile.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="w-full space-y-1">
                                <Label htmlFor="avatar">Avatar URL</Label>
                                <Input id="avatar" value={employeeProfile.avatar} onChange={handleInputChange} />
                            </div>
                        </div>
                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <Label htmlFor="name">Full Name</Label>
                                <Input id="name" value={employeeProfile.name} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" value={employeeProfile.email} disabled />
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="designation">Designation</Label>
                                <Input id="designation" value={employeeProfile.designation || ""} onChange={handleInputChange} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="linkedin">LinkedIn Profile</Label>
                                <Input id="linkedin" value={employeeProfile.linkedin || ""} onChange={handleInputChange} placeholder="https://linkedin.com/in/..."/>
                            </div>
                             <div className="space-y-1">
                                <Label htmlFor="emergencyContact">Emergency Contact</Label>
                                <Input id="emergencyContact" value={employeeProfile.emergencyContact || ""} onChange={handleInputChange} placeholder="+91..."/>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="bloodGroup">Blood Group</Label>
                                <Input id="bloodGroup" value={employeeProfile.bloodGroup || ""} onChange={handleInputChange} placeholder="e.g., O+, AB-"/>
                            </div>
                             <div className="space-y-1 sm:col-span-2">
                                <Label>Roles</Label>
                                <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
                                    {employeeProfile.role.join(", ")}
                                </p>
                                <p className="text-xs text-muted-foreground">Roles are managed by an administrator.</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
