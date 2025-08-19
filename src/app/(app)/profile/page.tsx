
"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc, addDoc, onSnapshot, orderBy } from "firebase/firestore";
import type { Employee, LeaveRequest } from "@/lib/data";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar as CalendarIcon, Send, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { addDays, format } from "date-fns";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ImageCropDialog } from "@/components/profile/image-crop-dialog";

function LeaveRequestForm({ employeeProfile, onLeaveRequest }: { employeeProfile: Employee, onLeaveRequest: (data: Omit<LeaveRequest, 'id' | 'createdAt' | 'employeeName'>) => Promise<void>}) {
    const [date, setDate] = React.useState<DateRange | undefined>();
    const [reason, setReason] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date?.from || !date?.to || !reason) {
            // Basic validation, should be improved with a form library if needed
            return;
        }
        setSubmitting(true);
        await onLeaveRequest({
            employeeId: employeeProfile.id,
            startDate: date.from.toISOString(),
            endDate: date.to.toISOString(),
            reason,
            status: "Pending",
        });
        setDate(undefined);
        setReason("");
        setSubmitting(false);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Request Leave</CardTitle>
                <CardDescription>Select the dates you will be unavailable.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                     <div className="grid gap-2">
                        <Label>Leave Dates</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn(
                                "w-full justify-start text-left font-normal",
                                !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                date.to ? (
                                    <>
                                    {format(date.from, "LLL dd, y")} -{" "}
                                    {format(date.to, "LLL dd, y")}
                                    </>
                                ) : (
                                    format(date.from, "LLL dd, y")
                                )
                                ) : (
                                <span>Pick a date range</span>
                                )}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={setDate}
                                numberOfMonths={1}
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="reason">Reason</Label>
                        <Textarea id="reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., Family vacation" />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={!date?.from || !reason || submitting}>
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4"/>}
                        Submit Request
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}

function LeaveHistory({ leaveRequests }: { leaveRequests: LeaveRequest[] }) {
    const getStatusVariant = (status: LeaveRequest['status']) => {
        switch (status) {
            case "Approved": return "default";
            case "Rejected": return "destructive";
            case "Pending": return "secondary";
            default: return "outline";
        }
    }
    return (
         <Card>
            <CardHeader>
                <CardTitle>Leave History</CardTitle>
                <CardDescription>Your past and pending leave requests.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Start Date</TableHead>
                            <TableHead>End Date</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {leaveRequests.length > 0 ? leaveRequests.map(req => (
                            <TableRow key={req.id}>
                                <TableCell>{format(new Date(req.startDate), "dd MMM, yyyy")}</TableCell>
                                <TableCell>{format(new Date(req.endDate), "dd MMM, yyyy")}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{req.reason}</TableCell>
                                <TableCell>
                                    <Badge variant={getStatusVariant(req.status)}>{req.status}</Badge>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">No leave requests found.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

export default function ProfilePage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [employeeProfile, setEmployeeProfile] = React.useState<Employee | null>(null);
    const [employeeDocId, setEmployeeDocId] = React.useState<string | null>(null);
    const [leaveRequests, setLeaveRequests] = React.useState<LeaveRequest[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // State for image cropping
    const [imgSrc, setImgSrc] = React.useState<string | null>(null);
    const [isCropDialogOpen, setIsCropDialogOpen] = React.useState(false);


    React.useEffect(() => {
        if (!user) return;
        setLoading(true);

        const fetchProfile = async () => {
            try {
                const employeeQuery = query(collection(db, "employees"), where("email", "==", user.email));
                const snapshot = await getDocs(employeeQuery);
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    const profile = { id: doc.id, ...doc.data() } as Employee;
                    setEmployeeProfile(profile);
                    setEmployeeDocId(doc.id);
                    
                    // Fetch leave requests after getting profile
                    const leaveQuery = query(collection(db, "leaveRequests"), where("employeeId", "==", profile.id), orderBy("createdAt", "desc"));
                    const unsub = onSnapshot(leaveQuery, (leaveSnapshot) => {
                        setLeaveRequests(leaveSnapshot.docs.map(d => ({id: d.id, ...d.data() } as LeaveRequest)));
                    });
                    // Detach listener on cleanup, though component might not unmount often
                    return () => unsub();
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

    const handleLeaveRequest = async (data: Omit<LeaveRequest, 'id' | 'createdAt' | 'employeeName'>) => {
        if (!employeeProfile) return;
        try {
            await addDoc(collection(db, "leaveRequests"), {
                ...data,
                employeeName: employeeProfile.name,
                createdAt: new Date().toISOString(),
            });
            toast({ title: "Success", description: "Your leave request has been submitted." });
        } catch (error) {
            console.error("Error submitting leave request:", error);
            toast({ title: "Error", description: "Failed to submit leave request.", variant: "destructive" });
        }
    }

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader();
            reader.addEventListener('load', () => setImgSrc(reader.result as string));
            reader.readAsDataURL(e.target.files[0]);
            setIsCropDialogOpen(true);
            e.target.value = ''; // Reset file input
        }
    };

    const handleCroppedImageSave = (croppedDataUrl: string) => {
        setEmployeeProfile(prev => prev ? { ...prev, avatar: croppedDataUrl } : null);
        setIsCropDialogOpen(false);
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
        <>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight font-headline">My Profile</h2>
                        <p className="text-muted-foreground">
                            View and edit your personal information and manage leave.
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
                                <div className="relative group">
                                    <Avatar className="h-32 w-32">
                                        <AvatarImage src={employeeProfile.avatar} alt={employeeProfile.name} />
                                        <AvatarFallback>{employeeProfile.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <Button 
                                        variant="outline"
                                        size="icon"
                                        className="absolute bottom-2 right-2 rounded-full h-8 w-8 bg-background/80 group-hover:bg-background"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Input 
                                        type="file" 
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/png, image/jpeg"
                                        onChange={onFileChange}
                                    />
                                </div>
                                <p className="text-sm text-muted-foreground text-center">Click the pencil to upload a new profile picture.</p>
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <LeaveRequestForm employeeProfile={employeeProfile} onLeaveRequest={handleLeaveRequest} />
                    <LeaveHistory leaveRequests={leaveRequests} />
                </div>
            </div>
             {imgSrc && (
                <ImageCropDialog
                    imgSrc={imgSrc}
                    isOpen={isCropDialogOpen}
                    onClose={() => setIsCropDialogOpen(false)}
                    onSave={handleCroppedImageSave}
                />
            )}
        </>
    );
}
