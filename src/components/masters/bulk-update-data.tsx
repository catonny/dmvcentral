
"use client";

import * as React from "react";
import { Button } from "../ui/button";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { useCSVReader } from "react-papaparse";
import { ValidationTable } from "./validation-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type MasterType = "Clients"; // Extendable to other types later

// Note: 'id' and 'lastUpdated' are system-managed and should not be in the bulk template.
export const CLIENT_HEADERS = [
    "Name",
    "Mail ID",
    "Mobile Number",
    "Category",
    "Partner",
    "Phone Number",
    "Date of Birth",
    "linkedClientIds",
    "PAN",
    "GSTN",
    "Billing Address Line 1",
    "Billing Address Line 2",
    "Billing Address Line 3",
    "State",
    "Country",
    "Contact Person",
    "Contact Person Designation"
];

export const MANDATORY_CLIENT_HEADERS = ["Name", "Mail ID", "Mobile Number", "Category", "Partner"];


export function BulkUpdateData({ onBack }: { onBack: () => void }) {
  const [selectedMaster, setSelectedMaster] = React.useState<MasterType | "">("Clients");
  const [parsedData, setParsedData] = React.useState<any[]>([]);
  const [isValidationDialogOpen, setIsValidationDialogOpen] = React.useState(false);
  const { CSVReader } = useCSVReader();

  const { toast } = useToast();
  

  React.useEffect(() => {
      if (parsedData.length > 0) {
          setIsValidationDialogOpen(true);
      }
  }, [parsedData]);

  const handleDownloadTemplate = () => {
    if (!selectedMaster) {
        toast({ title: "Error", description: "Please select a master data type first.", variant: "destructive"});
        return;
    }

    let headers: string[] = [];
    if (selectedMaster === "Clients") {
        headers = CLIENT_HEADERS.map(header => 
            MANDATORY_CLIENT_HEADERS.includes(header) ? `${header}*` : header
        );
    }
    // Future 'else if' blocks for other master types

    const csv = Papa.unparse([headers]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedMaster}_template.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Success", description: `Template for ${selectedMaster} downloaded.`});
  };

  const handleUpload = (results: any) => {
    const dataWithHeaders = results.data.map((row: any, index: number) => {
        if (index === 0) return row; // Keep headers as is for the first row
        
        const newRow: any = {};
        const headerRow = results.data[0];

        Object.keys(row).forEach(key => {
            const cleanKey = key.replace(/\*$/, '').trim();
            newRow[cleanKey] = row[key];
        });
        return newRow;
    }).slice(1); // Remove header row from final data

    setParsedData(dataWithHeaders);
  };
  
  return (
    <div className="space-y-6">
      {/* The back button can be hidden if this component is always top-level in a tab */}
      {/* <Button variant="outline" size="sm" onClick={onBack} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Actions
      </Button> */}
      <Card>
        <CardHeader>
          <CardTitle>Bulk Update Clients</CardTitle>
          <CardDescription>
            Download a CSV template, fill it with your data, and upload it to add or update client records in bulk. Fields marked with * are mandatory.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <h3 className="font-medium">Step 1: Download Template</h3>
                <div className="flex items-center gap-4">
                    <Button onClick={handleDownloadTemplate} disabled={!selectedMaster}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Client Template
                    </Button>
                </div>
            </div>

            <div className="space-y-2">
                 <h3 className="font-medium">Step 2: Upload Completed CSV File</h3>
                <CSVReader
                    onUploadAccepted={(results: any) => {
                        handleUpload(results);
                    }}
                    onDragOver={(e: any) => e.preventDefault()}
                    onDragLeave={(e: any) => e.preventDefault()}
                    config={{ header: true, skipEmptyLines: true }}
                >
                    {({ getRootProps, acceptedFile, ProgressBar, getRemoveFileProps, Remove }: any) => {
                        const removeFile = (e?: React.MouseEvent<HTMLButtonElement>) => {
                            if (e) e.stopPropagation();
                            setParsedData([]);
                            (Remove as any)();
                        }
                        
                        const handleDialogClose = (open: boolean) => {
                            if (!open) {
                                setIsValidationDialogOpen(false);
                                removeFile();
                            } else {
                                setIsValidationDialogOpen(true);
                            }
                        }

                        const onImportComplete = () => {
                             handleDialogClose(false);
                        }
                        
                        return (
                        <>
                        <Card {...getRootProps()} className="p-8 border-dashed flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary transition-colors">
                            <Upload className="h-12 w-12 text-muted-foreground" />
                            
                            {acceptedFile ? (
                                <>
                                    <p className="mt-4 text-muted-foreground">
                                        File <span className="font-semibold text-primary">{acceptedFile.name}</span> selected.
                                    </p>
                                    <p className="text-xs text-muted-foreground">Validation dialog will open automatically.</p>
                                    <div className="w-full max-w-xs mt-2">
                                        <ProgressBar />
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="mt-2"
                                        onClick={removeFile}
                                        >
                                        Remove
                                    </Button>
                                </>
                            ) : (
                                <p className="mt-4 text-muted-foreground">Drag & drop your file here or click to browse.</p>
                            )}
                        </Card>
                         <Dialog open={isValidationDialogOpen} onOpenChange={handleDialogClose}>
                            <DialogContent className="max-w-6xl w-full h-[90vh] flex flex-col">
                                <DialogHeader>
                                    <DialogTitle>Validate and Import Clients</DialogTitle>
                                    <DialogDescription>
                                        Review the data you've uploaded. Click "Validate Data" to check for errors, then import.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="flex-grow overflow-hidden">
                                    <ValidationTable 
                                        data={parsedData} 
                                        onComplete={onImportComplete}
                                    />
                                </div>
                            </DialogContent>
                        </Dialog>
                        </>
                    )}}
                </CSVReader>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
