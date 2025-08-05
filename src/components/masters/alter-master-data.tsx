

"use client";

import * as React from "react";
import { collection, query, getDocs, doc, writeBatch, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "../ui/button";
import { ArrowLeft, ChevronRight, Edit, Loader2, MoreHorizontal, Trash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type AlterableMasterType = "Engagement Types" | "Departments" | "Client Categories" | "Audit Templates";
const ALTERABLE_MASTER_TYPES: AlterableMasterType[] = ["Engagement Types", "Departments", "Client Categories", "Audit Templates"];

export function AlterMasterData({ onBack }: { onBack: () => void }) {
  const [selectedMaster, setSelectedMaster] = React.useState<AlterableMasterType | null>(null);
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [recordToDelete, setRecordToDelete] = React.useState<any>(null);
  const [recordToEdit, setRecordToEdit] = React.useState<any>(null);
  const [editFormData, setEditFormData] = React.useState<any>({});
  
  const { toast } = useToast();

  const fetchMasterData = async (masterType: AlterableMasterType) => {
    setLoading(true);
    try {
      let collectionName = "";
      switch (masterType) {
        case "Engagement Types": collectionName = "engagementTypes"; break;
        case "Departments": collectionName = "departments"; break;
        case "Client Categories": collectionName = "clientCategories"; break;
        case "Audit Templates": collectionName = "auditTemplates"; break;
        default: throw new Error("Unknown master type");
      }
      const q = query(collection(db, collectionName));
      const snapshot = await getDocs(q);
      const fetchedData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(fetchedData);
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast({ title: "Error", description: `Failed to fetch ${masterType}.`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (selectedMaster) {
      fetchMasterData(selectedMaster);
    }
  }, [selectedMaster, toast]);
  
  React.useEffect(() => {
    setEditFormData(recordToEdit || {});
  }, [recordToEdit])

  const handleSelectMaster = (masterType: AlterableMasterType) => {
    setSelectedMaster(masterType);
  };

  const handleBack = () => {
    if (selectedMaster) {
      setSelectedMaster(null);
      setData([]);
    } else {
      onBack();
    }
  };
  
  const confirmDelete = (record: any) => {
    setRecordToDelete(record);
    setIsConfirmDeleteOpen(true);
  }
  
  const openEditDialog = (record: any) => {
      setRecordToEdit(record);
      setIsEditDialogOpen(true);
  }

  const handleDelete = async () => {
    if (!recordToDelete || !selectedMaster) return;
    
    let collectionName = "";
    switch (selectedMaster) {
        case "Engagement Types": collectionName = "engagementTypes"; break;
        case "Departments": collectionName = "departments"; break;
        case "Client Categories": collectionName = "clientCategories"; break;
        case "Audit Templates": collectionName = "auditTemplates"; break;
    }

    try {
      await deleteDoc(doc(db, collectionName, recordToDelete.id));
      toast({ title: "Success", description: "Record deleted successfully." });
      setData(prev => prev.filter(item => item.id !== recordToDelete.id));
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({ title: "Error", description: "Failed to delete record.", variant: "destructive" });
    } finally {
        setIsConfirmDeleteOpen(false);
        setRecordToDelete(null);
    }
  };
  
  const handleUpdate = async () => {
    if (!recordToEdit || !selectedMaster) return;
     let collectionName = "";
    switch (selectedMaster) {
        case "Engagement Types": collectionName = "engagementTypes"; break;
        case "Departments": collectionName = "departments"; break;
        case "Client Categories": collectionName = "clientCategories"; break;
        case "Audit Templates": collectionName = "auditTemplates"; break;
    }
    
    try {
        const docRef = doc(db, collectionName, recordToEdit.id);
        const { id, ...dataToUpdate } = editFormData; // Exclude ID from update payload
        await updateDoc(docRef, dataToUpdate);
        toast({ title: "Success", description: "Record updated successfully." });
        setData(prev => prev.map(item => item.id === recordToEdit.id ? { ...item, ...editFormData } : item));
    } catch(e) {
        console.error("Error updating record: ", e);
        toast({ title: "Error", description: "Failed to update record.", variant: "destructive" });
    } finally {
        setIsEditDialogOpen(false);
        setRecordToEdit(null);
    }
  }

  const renderTable = () => {
    if (loading) return <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!selectedMaster) return null;
    if (data.length === 0) return <div>No data found for {selectedMaster}.</div>;

    const headers = Object.keys(data[0]).filter(key => key !== 'id' && key !== 'subTaskTitles');

    return (
        <Card>
            <CardHeader>
                <CardTitle>Alter {selectedMaster}</CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="w-full whitespace-nowrap">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            {headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {data.map((item) => (
                            <TableRow key={item.id}>
                            {headers.map(header => (
                                <TableCell key={header}>
                                    {String(item[header])}
                                </TableCell>
                            ))}
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Open menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openEditDialog(item)}>
                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => confirmDelete(item)} className="text-destructive">
                                            <Trash className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    <ScrollBar orientation="vertical" />
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
        </Card>
    );
  };

  return (
    <div>
      <Button variant="outline" size="sm" onClick={handleBack} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      
      {!selectedMaster ? (
        <div className="space-y-4">
            <CardHeader className="p-0">
                <CardTitle>Alter Master Data</CardTitle>
                <CardDescription>Select the type of master data you want to edit or delete.</CardDescription>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ALTERABLE_MASTER_TYPES.map(type => (
                <Card 
                    key={type} 
                    onClick={() => handleSelectMaster(type)}
                    className="cursor-pointer hover:bg-muted/50 transition-colors group"
                >
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>{type}</CardTitle>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </CardHeader>
                </Card>
            ))}
            </div>
        </div>
      ) : renderTable() }

       <AlertDialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the record for <strong>{recordToDelete?.name}</strong>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setRecordToDelete(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit {selectedMaster?.slice(0, -1)}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input
                            id="name"
                            value={editFormData?.name || ""}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                     {(selectedMaster === "Engagement Types" || selectedMaster === "Audit Templates") && (
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">Description</Label>
                            <Input
                                id="description"
                                value={editFormData?.description || ""}
                                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                     )}
                     {selectedMaster === "Audit Templates" && (
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="part" className="text-right">Part</Label>
                            <Input
                                id="part"
                                value={editFormData?.part || ""}
                                onChange={(e) => setEditFormData({ ...editFormData, part: e.target.value })}
                                className="col-span-3"
                                disabled
                            />
                        </div>
                     )}
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button onClick={handleUpdate}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
