
"use client";

import * as React from "react";
import { Button } from "../ui/button";
import { Download, Upload, Loader2, AlertTriangle, SkipForward, DatabaseBackup, Database } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import { useCSVReader } from "react-papaparse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";
import type { RecurringEngagement, EngagementType, Client, Employee } from "@/lib/data";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "@/lib/utils";
import { writeBatch, doc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ScrollArea } from "../ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const RECURRING_HEADERS = ["Client Name", "Engagement Type", "Fees", "Assigned To", "Reported To", "Due Day", "Due Month"];
const MANDATORY_RECURRING_HEADERS = ["Client Name", "Engagement Type", "Fees", "Assigned To", "Reported To", "Due Day"];

interface BulkCreateRecurringEngagementsProps {
    allEmployees: Employee[];
    allClients: Client[];
    allEngagementTypes: EngagementType[];
}

interface ValidatedRow {
    row: any;
    client?: Client;
    engagementType?: EngagementType;
    assignedTo?: Employee;
    reporter?: Employee;
    errors: { [key: string]: string };
    originalIndex: number;
    action: "CREATE" | "IGNORE" | "DUPLICATE";
    duplicateReason?: string;
}

interface ValidationResult {
    rows: ValidatedRow[];
    summary: {
        creates: number;
        ignores: number;
        duplicates: number;
    }
}

export function BulkCreateRecurringEngagements({ allEmployees, allClients, allEngagementTypes }: BulkCreateRecurringEngagementsProps) {
  const [parsedData, setParsedData] = React.useState<any[]>([]);
  const [isValidationDialogOpen, setIsValidationDialogOpen] = React.useState(false);
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null);
  const [isFiltered, setIsFiltered] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  
  const { CSVReader } = useCSVReader();
  const { toast } = useToast();

  React.useEffect(() => {
    if (parsedData.length > 0) {
      setIsValidationDialogOpen(true);
    }
  }, [parsedData]);
  
  const handleDownloadTemplate = () => {
    const headers = RECURRING_HEADERS.map(h => MANDATORY_RECURRING_HEADERS.includes(h) ? `${h}*` : h);
    
    const dummyData = [
        {
            "Client Name*": "Innovate Inc.",
            "Engagement Type*": "GST Filing",
            "Fees*": "10000",
            "Assigned To*": "Dojo Davis",
            "Reported To*": "Dojo Davis",
            "Due Day*": "20",
            "Due Month": ""
        },
        {
            "Client Name*": "GreenFuture LLP",
            "Engagement Type*": "ITR Filing",
            "Fees*": "15000",
            "Assigned To*": "Dojo Davis",
            "Reported To*": "Dojo Davis",
            "Due Day*": "31",
            "Due Month": "7"
        }
    ];

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
    link.setAttribute("download", `bulk_recurring_engagement_template.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Success", description: `Bulk recurring engagement template downloaded.` });
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
  
  const handleValidate = async () => {
    setIsValidating(true);
    setValidationResult(null);

    const clientNameMap = new Map(allClients.map(c => [c.Name.toLowerCase(), c]));
    const employeeNameMap = new Map(allEmployees.map(e => [e.name.toLowerCase(), e]));
    const recurringEngagementTypes = allEngagementTypes.filter(et => et.recurrence);
    const engagementTypeNameMap = new Map(recurringEngagementTypes.map(et => [et.name.toLowerCase(), et]));
    
    const existingRecurringSnapshot = await getDocs(collection(db, "recurringEngagements"));
    const existingRecurringKeys = new Set(existingRecurringSnapshot.docs.map(doc => {
        const data = doc.data() as RecurringEngagement;
        return `${data.clientId}_${data.engagementTypeId}`;
    }));

    const result: ValidationResult = {
        rows: [],
        summary: { creates: 0, ignores: 0, duplicates: 0 }
    };
    
    const processedInCsv = new Set<string>();

    parsedData.forEach((row, rowIndex) => {
        const errors: { [key: string]: string } = {};
        let action: "CREATE" | "IGNORE" | "DUPLICATE" = "CREATE";
        let duplicateReason = "";

        MANDATORY_RECURRING_HEADERS.forEach(header => {
            if (!row[header] || String(row[header]).trim() === '') {
                errors[header] = `Mandatory field is missing.`;
                action = "IGNORE";
            }
        });
        
        if (action === "IGNORE") {
             result.rows.push({ row, action, errors, originalIndex: rowIndex, duplicateReason });
             return;
        }

        const client = clientNameMap.get(row["Client Name"]?.toLowerCase());
        const engagementType = engagementTypeNameMap.get(row["Engagement Type"]?.toLowerCase());
        const assignedTo = employeeNameMap.get(row["Assigned To"]?.toLowerCase());
        const reporter = employeeNameMap.get(row["Reported To"]?.toLowerCase());

        const csvKey = `${client?.id}_${engagementType?.id}`;
        if (processedInCsv.has(csvKey)) {
            action = "DUPLICATE";
            duplicateReason = "This is a duplicate of another row in the same CSV file.";
        } else {
            processedInCsv.add(csvKey);
        }

        if (client && engagementType && existingRecurringKeys.has(`${client.id}_${engagementType.id}`)) {
            action = "DUPLICATE";
            duplicateReason = "A recurring engagement of this type already exists for this client.";
        }
        
        if (!client) errors["Client Name"] = `Client "${row["Client Name"]}" not found.`;
        if (!engagementType) errors["Engagement Type"] = `Type "${row["Engagement Type"]}" not found or is not recurring.`;
        if (!assignedTo) errors["Assigned To"] = `User "${row["Assigned To"]}" not found.`;
        if (!reporter) errors["Reported To"] = `User "${row["Reported To"]}" not found.`;

        const dueDay = Number(row["Due Day"]);
        if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
            errors["Due Day"] = "Must be a number between 1 and 31.";
        }
        if (row["Due Month"]) {
            const dueMonth = Number(row["Due Month"]);
            if (isNaN(dueMonth) || dueMonth < 1 || dueMonth > 12) {
                errors["Due Month"] = "Must be a number between 1 and 12.";
            }
        }
        
        if (Object.keys(errors).length > 0) action = "IGNORE";

        result.rows.push({
            row, action, errors, client, engagementType, assignedTo, reporter,
            originalIndex: rowIndex, duplicateReason
        });
    });

    result.summary = result.rows.reduce((acc, r) => {
        if(r.action === "CREATE") acc.creates++;
        else if(r.action === "IGNORE") acc.ignores++;
        else if(r.action === "DUPLICATE") acc.duplicates++;
        return acc;
    }, {creates: 0, ignores: 0, duplicates: 0});
    
    setValidationResult(result);
    setIsValidating(false);

    if (result.summary.ignores > 0 || result.summary.duplicates > 0) setIsFiltered(true);

     toast({
        title: "Validation Complete",
        description: `Found ${result.summary.creates} new, ${result.summary.duplicates} duplicates, and ${result.summary.ignores} rows with errors.`,
     });
  };

  const handleImport = async (skipDuplicates: boolean) => {
    if (!validationResult) return;
    setIsImporting(true);

    const rowsToImport = validationResult.rows.filter(r => r.action === "CREATE" || (r.action === "DUPLICATE" && !skipDuplicates));

    if (rowsToImport.length === 0) {
        toast({ title: "No Data to Import", description: "No valid records to import."});
        setIsImporting(false);
        return;
    }

    const batch = writeBatch(db);
    rowsToImport.forEach(item => {
        const { row, client, engagementType, assignedTo, reporter } = item;
        if (client && engagementType && assignedTo && reporter) {
            const newDocRef = doc(collection(db, 'recurringEngagements'));
            const newEngagement: Omit<RecurringEngagement, 'id'> = {
                clientId: client.id,
                engagementTypeId: engagementType.id,
                fees: Number(row["Fees"]) || 0,
                isActive: true,
                assignedTo: [assignedTo.id],
                reportedTo: reporter.id,
                dueDateDay: Number(row["Due Day"]),
                dueDateMonth: row["Due Month"] ? Number(row["Due Month"]) : undefined
            };
            batch.set(newDocRef, { ...newEngagement, id: newDocRef.id });
        }
    });

    try {
        await batch.commit();
        toast({ title: "Import Complete", description: `${rowsToImport.length} recurring engagements created successfully.` });
        setIsValidationDialogOpen(false);
    } catch (error) {
        console.error("Error during bulk recurring creation:", error);
        toast({ title: "Import Failed", description: "Could not create recurring engagements.", variant: "destructive" });
    } finally {
        setIsImporting(false);
    }
  }

  const handleDialogClose = (open: boolean) => {
    if (!open) {
        setIsValidationDialogOpen(false);
        setParsedData([]);
        setValidationResult(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Create Recurring Engagements</CardTitle>
        <CardDescription>
          Upload a CSV to create new recurring services for your clients. Fields with * are mandatory.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="font-medium">Step 1: Download Template</h3>
          <Button onClick={handleDownloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
        </div>

        <div className="space-y-2">
          <h3 className="font-medium">Step 2: Upload Completed CSV File</h3>
            <CSVReader
                onUploadAccepted={(results: any) => handleUpload(results)}
                config={{ skipEmptyLines: true, header: true, comments: "#" }}
            >
            {({ getRootProps, acceptedFile, ProgressBar, getRemoveFileProps }: any) => {
                const removeFile = (e?: React.MouseEvent<HTMLButtonElement>) => {
                    if (e) e.stopPropagation();
                    setParsedData([]);
                    setValidationResult(null);
                    (getRemoveFileProps() as any).onClick(e);
                };
                
                return (
                    <>
                        <Card {...getRootProps()} className="p-8 border-dashed flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary transition-colors">
                            <Upload className="h-12 w-12 text-muted-foreground" />
                            {acceptedFile ? (
                                <>
                                    <p className="mt-4 text-muted-foreground">File <span className="font-semibold text-primary">{acceptedFile.name}</span> selected.</p>
                                    <Button variant="destructive" size="sm" className="mt-2" onClick={removeFile}>Remove</Button>
                                </>
                            ) : (
                                <p className="mt-4 text-muted-foreground">Drag & drop your file here or click to browse.</p>
                            )}
                        </Card>
                        <Dialog open={isValidationDialogOpen} onOpenChange={handleDialogClose}>
                            <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col">
                                <DialogHeader>
                                    <DialogTitle>Validate and Create Recurring Engagements</DialogTitle>
                                    <DialogDescription>Review the data, validate for errors, then import.</DialogDescription>
                                </DialogHeader>
                                <TooltipProvider>
                                    <div className="flex-grow overflow-hidden">
                                        <ScrollArea className="h-full rounded-md border">
                                            <Table>
                                                <TableHeader className="sticky top-0 bg-muted z-10">
                                                    <TableRow>
                                                        {RECURRING_HEADERS.map(header => <TableHead key={header}>{header}</TableHead>)}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {/* Table body content here */}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    </div>
                                    <DialogFooter className="pt-4 flex-wrap gap-2">
                                        <div className="flex-grow text-sm text-muted-foreground">
                                          {parsedData.length} records found.
                                        </div>
                                        <div className="flex gap-2">
                                          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                          <Button onClick={handleValidate} disabled={isValidating}>{isValidating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validating...</> : 'Validate Data'}</Button>
                                          <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                  <Button disabled={!validationResult || isImporting}>
                                                      {isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : 'Import Data'}
                                                  </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                  <AlertDialogHeader>
                                                      <AlertDialogTitle>Confirm Import</AlertDialogTitle>
                                                      <div className="text-sm text-muted-foreground py-4 space-y-1">
                                                        <p><b>{validationResult?.summary.creates || 0}</b> new recurring engagements will be created.</p>
                                                        <p><b>{validationResult?.summary.duplicates || 0}</b> duplicates found.</p>
                                                        <p><b>{validationResult?.summary.ignores || 0}</b> rows with errors will be ignored.</p>
                                                      </div>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                      {(validationResult?.summary.duplicates || 0) > 0 ? (
                                                          <>
                                                              <Button variant="destructive" onClick={() => handleImport(false)}>Overwrite Duplicates</Button>
                                                              <AlertDialogAction onClick={() => handleImport(true)}>Skip Duplicates & Import</AlertDialogAction>
                                                          </>
                                                      ) : (
                                                          <AlertDialogAction onClick={() => handleImport(true)}>Import Valid Data</AlertDialogAction>
                                                      )}
                                                  </AlertDialogFooter>
                                              </AlertDialogContent>
                                          </AlertDialog>
                                        </div>
                                    </DialogFooter>
                                </TooltipProvider>
                            </DialogContent>
                        </Dialog>
                    </>
                );
            }}
            </CSVReader>
        </div>
      </CardContent>
    </Card>
  );
}

