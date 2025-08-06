
"use client";

import * as React from "react";
import { Button } from "../ui/button";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Department } from "@/lib/data";

type CreatableMasterType = "Departments" | "Client Categories";
const CREATABLE_MASTER_TYPES: CreatableMasterType[] = ["Departments", "Client Categories"];

export function CreateMasterData({ onBack }: { onBack: () => void }) {
  const [selectedMaster, setSelectedMaster] = React.useState<CreatableMasterType | null>(null);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!selectedMaster || !name) {
      toast({ title: "Validation Error", description: "Please select a type and provide a name.", variant: "destructive" });
      return;
    }
    setLoading(true);

    try {
      let collectionName = "";
      let data: any = { name };

      switch (selectedMaster) {
        case "Departments":
          collectionName = "departments";
          const deptsQuery = query(collection(db, "departments"));
          const deptsSnapshot = await getDocs(deptsQuery);
          const depts = deptsSnapshot.docs.map(doc => doc.data() as Department);
          const maxOrder = depts.reduce((max, d) => Math.max(max, d.order), 0);
          data.order = maxOrder + 1;
          break;
        case "Client Categories":
          collectionName = "clientCategories";
          break;
      }
      
      const docRef = await addDoc(collection(db, collectionName), {});
      await updateDoc(docRef, { ...data, id: docRef.id });


      toast({ title: "Success", description: `${selectedMaster.slice(0, -1)} '${name}' created successfully.` });
      setName("");
      setDescription("");
      setSelectedMaster(null);
    } catch (error) {
      console.error("Error creating master data:", error);
      toast({ title: "Error", description: `Failed to create new entry.`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  
  const renderForm = () => {
    if (!selectedMaster) return null;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Create New {selectedMaster.slice(0, -1)}</CardTitle>
          <CardDescription>Fill in the details for the new master record.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter name" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelectedMaster(null)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={onBack} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Actions
      </Button>

      {selectedMaster ? (
        renderForm()
      ) : (
        <div className="space-y-4">
            <CardHeader className="p-0">
                <CardTitle>Create a New Master Record</CardTitle>
                <CardDescription>First, select the type of master data you want to create.</CardDescription>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {CREATABLE_MASTER_TYPES.map(type => (
                    <Card 
                        key={type} 
                        onClick={() => setSelectedMaster(type)}
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
      )}
    </div>
  );
}
