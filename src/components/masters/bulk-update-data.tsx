

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
    "name",
    "mailId",
    "mobileNumber",
    "category",
    "partner",
    "firmName",
    "phoneNumber",
    "dateOfBirth",
    "linkedClientIds",
    "pan",
    "gstin",
    "billingAddressLine1",
    "billingAddressLine2",
    "billingAddressLine3",
    "pincode",
    "state",
    "country",
    "contactPerson",
    "contactPersonDesignation"
];

export const MANDATORY_CLIENT_HEADERS = ["name", "mailId", "mobileNumber", "category", "partner", "firmName"];


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
    let dummyData: any[] = [];

    if (selectedMaster === "Clients") {
        headers = CLIENT_HEADERS.map(header => 
            MANDATORY_CLIENT_HEADERS.includes(header) ? `${header}*` : header
        );
        dummyData = [
            {
                "name*": "Example Corp",
                "mailId*": "contact@examplecorp.com",
                "mobileNumber*": "9876543210",
                "category*": "Corporate",
                "partner*": "Dojo Davis",
                "firmName*": "Davis, Martin & Varghese",
                "phoneNumber": "0484-2345678",
                "dateOfBirth": "",
                "linkedClientIds": "",
                "pan": "AABCE1234F",
                "gstin": "22AABCE1234F1Z5",
                "billingAddressLine1": "123 Business Ave",
                "billingAddressLine2": "Commerce Street",
                "billingAddressLine3": "Financial District",
                "pincode": "400001",
                "state": "Maharashtra",
                "country": "India",
                "contactPerson": "Rohan Sharma",
                "contactPersonDesignation": "Finance Head"
            },
            {
                "name*": "Jane Smith",
                "mailId*": "jane.smith@email.com",
                "mobileNumber*": "9123456780",
                "category*": "Individual",
                "partner*": "Dojo Davis",
                "firmName*": "Davis, Martin & Varghese",
                "phoneNumber": "",
                "dateOfBirth": "15/05/1990",
                "linkedClientIds": "",
                "pan": "JKLMN5678G",
                "gstin": "",
                "billingAddressLine1": "Apt 4B, Residence Towers",
                "billingAddressLine2": "Green Valley",
                "billingAddressLine3": "",
                "pincode": "560001",
                "state": "Karnataka",
                "country": "India",
                "contactPerson": "",
                "contactPersonDesignation": ""
            }
        ];
    }
    
    const csvContent = Papa.unparse({
        fields: headers,
        data: dummyData
    });
    
    const footerMessage = "\n\n# IMPORTANT: Please delete these example rows before entering your own data and uploading the file.";
    const fullCsv = csvContent + footerMessage;

    const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8;" });
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
    // react-papaparse with header: true returns an array of objects in results.data
    // We just need to clean the keys.
    const dataRows = results.data.map((row: any) => {
        const newRow: any = {};
        Object.keys(row).forEach(key => {
            newRow[key.replace(/\*$/, '').trim()] = row[key];
        });
        return newRow;
    });

    setParsedData(dataRows);
  };
  
  return (
    <div className="space-y-6">
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
                    config={{ header: true, skipEmptyLines: true, comments: "#" }}
                >
                    {({ getRootProps, acceptedFile, ProgressBar, getRemoveFileProps }: any) => {
                        
                        const handleDialogClose = (open: boolean) => {
                            if (!open) {
                                setIsValidationDialogOpen(false);
                                setParsedData([]);
                                // This is the correct way to trigger the file removal without an event
                                getRemoveFileProps().onClick();
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
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            getRemoveFileProps().onClick(e);
                                            setParsedData([]);
                                        }}
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
