
"use client";

import * as React from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Button } from "../ui/button";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

type MasterType = "Engagement Types" | "Employees" | "Departments" | "Client Categories";

const MASTER_TYPES: MasterType[] = ["Engagement Types", "Employees", "Departments", "Client Categories"];

export function ViewMasterData({ onBack }: { onBack: () => void }) {
  const [selectedMaster, setSelectedMaster] = React.useState<MasterType | null>(null);
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const { toast } = useToast();

  const handleSelectMaster = async (masterType: MasterType) => {
    setSelectedMaster(masterType);
    setLoading(true);
    try {
      let q;
      switch (masterType) {
        case "Engagement Types":
          q = query(collection(db, "engagementTypes"), orderBy("name"));
          break;
        case "Employees":
          q = query(collection(db, "employees"), orderBy("name"));
          break;
        case "Departments":
          q = query(collection(db, "departments"), orderBy("order"));
          break;
        case "Client Categories":
            q = query(collection(db, "clientCategories"), orderBy("name"));
            break;
        default:
          throw new Error("Unknown master type");
      }
      const snapshot = await getDocs(q);
      const fetchedData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(fetchedData);
    } catch (error) {
      console.error("Error fetching master data:", error);
      toast({
        title: "Error",
        description: `Failed to fetch ${masterType}.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleBack = () => {
      if (selectedMaster) {
          setSelectedMaster(null);
          setData([]);
      } else {
          onBack();
      }
  }

  const renderTable = () => {
    if (loading) return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!selectedMaster) return null;
    if (data.length === 0) return <div className="text-center p-8 text-muted-foreground">No data found for {selectedMaster}.</div>;

    const headers = Object.keys(data[0]).filter(key => key !== 'id' && !key.toLowerCase().includes('avatar'));

    return (
        <Card>
            <CardHeader>
                <CardTitle>{selectedMaster}</CardTitle>
                <CardDescription>A list of all records for this master data type.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="w-full whitespace-nowrap">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            {selectedMaster === "Employees" && <TableHead>Avatar</TableHead>}
                            {headers.map(header => <TableHead key={header}>{header.replace(/([A-Z])/g, ' $1')}</TableHead>)}
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {data.map((item) => (
                            <TableRow key={item.id}>
                                {selectedMaster === "Employees" && (
                                    <TableCell>
                                        <Avatar>
                                            <AvatarImage src={item.avatar} alt={item.name} />
                                            <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </TableCell>
                                )}
                                {headers.map(header => (
                                    <TableCell key={header}>
                                        {Array.isArray(item[header]) ? item[header].join(', ') : String(item[header])}
                                    </TableCell>
                                ))}
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
                <CardTitle>View Master Data</CardTitle>
                <CardDescription>Select a master data type to view its records.</CardDescription>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MASTER_TYPES.map(type => (
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
    </div>
  );
}
