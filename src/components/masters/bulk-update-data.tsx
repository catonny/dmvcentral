
"use client";

import * as React from "react";
import { Button } from "../ui/button";
import { Download, Upload } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Card } from "../ui/card";

type MasterType = "Clients"; // Extendable to other types later

export const CLIENT_HEADERS = [
    "Name",
    "Mail ID",
    "Mobile Number",
    "Category",
    "Partner",
    "Firm Name",
    "Phone Number",
    "Date of Birth",
    "linkedClientIds",
    "PAN",
    "GSTN",
    "Billing Address Line 1",
    "Billing Address Line 2",
    "Billing Address Line 3",
    "Pincode",
    "State",
    "Country",
    "Contact Person",
    "Contact Person Designation"
];

export const MANDATORY_CLIENT_HEADERS = ["Name", "Mail ID", "Mobile Number", "Category", "Partner", "Firm Name"];


export function BulkUpdateData({ onBack }: { onBack: () => void }) {
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
    let headers: string[] = [];
    let dummyData: any[] = [];

    headers = CLIENT_HEADERS.map(header => 
        MANDATORY_CLIENT_HEADERS.includes(header) ? `${header}*` : header
    );
    dummyData = [
        {
            "Name*": "Example Corp",
            "Mail ID*": "contact@examplecorp.com",
            "Mobile Number*": "9876543210",
            "Category*": "Corporate",
            "Partner*": "Dojo Davis",
            "Firm Name*": "Davis, Martin & Varghese",
            "Phone Number": "0484-2345678",
            "Date of Birth": "",
            "linkedClientIds": "",
            "PAN": "AABCE1234F",
            "GSTN": "22AABCE1234F1Z5",
            "Billing Address Line 1": "123 Business Ave",
            "Billing Address Line 2": "Commerce Street",
            "Billing Address Line 3": "Financial District",
            "Pincode": "400001",
            "State": "Maharashtra",
            "Country": "India",
            "Contact Person": "Rohan Sharma",
            "Contact Person Designation": "Finance Head"
        },
    ];
    
    const csvContent = Papa.unparse({
        fields: headers,
        data: dummyData
    });
    
    const footerMessage = "\n\n# IMPORTANT: Please delete the example row before entering your own data.";
    const fullCsv = csvContent + footerMessage;

    const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `clients_template.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Success", description: `Template for Clients downloaded.`});
  };

  const handleUpload = (results: any) => {
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
    <div className="space-y-4">
        <div className="space-y-2">
            <h3 className="font-medium text-sm">Step 1: Get Template</h3>
            <Button onClick={handleDownloadTemplate} size="sm" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download Template
            </Button>
        </div>

        <div className="space-y-2">
             <h3 className="font-medium text-sm">Step 2: Upload File</h3>
            <CSVReader
                onUploadAccepted={(results: any) => handleUpload(results)}
                config={{ header: true, skipEmptyLines: true, comments: "#" }}
            >
                {({ getRootProps, acceptedFile, getRemoveFileProps }: any) => {
                    const handleDialogClose = (open: boolean) => {
                        if (!open) {
                            setIsValidationDialogOpen(false);
                            setParsedData([]);
                            getRemoveFileProps().onClick();
                        }
                    }

                    const onImportComplete = () => {
                         handleDialogClose(false);
                    }
                    
                    return (
                    <>
                    <div {...getRootProps()} className="p-4 border-2 border-dashed rounded-lg text-center cursor-pointer hover:border-primary transition-colors">
                        {acceptedFile ? (
                            <p className="text-sm text-muted-foreground">
                                {acceptedFile.name}
                            </p>
                        ) : (
                            <p className="text-sm text-muted-foreground">Click or drag to upload</p>
                        )}
                    </div>
                     <Dialog open={isValidationDialogOpen} onOpenChange={handleDialogClose}>
                        <DialogContent className="max-w-6xl w-full h-[90vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle>Validate and Import Clients</DialogTitle>
                                <DialogDescription>
                                    Review your uploaded data, validate it for errors, and then import.
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
    </div>
  );
}
