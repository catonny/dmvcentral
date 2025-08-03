
"use client";

import * as React from "react";
import { Button } from "../ui/button";
import { Download, Upload } from "lucide-react";
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
} from "@/components/ui/dialog"
import type { Engagement, EngagementType, Client, Employee, Task } from "@/lib/data";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { writeBatch, doc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format, parse } from "date-fns";

const ASSIGNMENT_HEADERS = ["Engagement Type", "Client Name", "Due Date", "Allotted User", "Remarks"];
const MANDATORY_ASSIGNMENT_HEADERS = ["Engagement Type", "Client Name", "Due Date", "Allotted User"];

interface BulkCreateEngagementsProps {
    allEmployees: Employee[];
    allClients: Client[];
    allEngagementTypes: EngagementType[];
}

interface ValidatedRow {
    row: any;
    client?: Client;
    engagementType?: EngagementType;
    allottedUser?: Employee;
    parsedDate?: Date;
    errors: { [key: string]: string };
    originalIndex: number;
    action: "CREATE" | "IGNORE";
}

interface ValidationResult {
    rows: ValidatedRow[];
    summary: {
        creates: number;
        ignores: number;
    }
}

export function BulkCreateEngagements({ allEmployees, allClients, allEngagementTypes }: BulkCreateEngagementsProps) {
  const [parsedData, setParsedData] = React.useState<any[]>([]);
  const [isValidationDialogOpen, setIsValidationDialogOpen] = React.useState(false);
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null);
  const [isFiltered, setIsFiltered] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  
  const { CSVReader } = useCSVReader();
  const { toast } = useToast();

  React.useEffect(() => {
    if (parsedData.length > 0) {
      setIsValidationDialogOpen(true);
    }
  }, [parsedData]);
  
  const handleDownloadTemplate = () => {
    const headers = ASSIGNMENT_HEADERS.map(h => MANDATORY_ASSIGNMENT_HEADERS.includes(h) ? `${h}*` : h);
    const csv = Papa.unparse([headers]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `bulk_engagement_creation_template.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Success", description: `Bulk creation template downloaded.` });
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
    const employeeNameMap = new Map(allEmployees.map(s => [s.name.toLowerCase(), s]));
    const engagementTypeNameMap = new Map(allEngagementTypes.map(et => [et.name.toLowerCase(), et]));

    const result: ValidationResult = {
        rows: [],
        summary: { creates: 0, ignores: 0 }
    };

    parsedData.forEach((row, rowIndex) => {
        const errors: { [key: string]: string } = {};
        let action: "CREATE" | "IGNORE" = "CREATE";

        // Check for mandatory fields first
        MANDATORY_ASSIGNMENT_HEADERS.forEach(header => {
            if (!row[header] || String(row[header]).trim() === '') {
                errors[header] = `Mandatory field is missing.`;
                action = "IGNORE";
            }
        });

        const clientName = row["Client Name"]?.toLowerCase();
        const engagementTypeName = row["Engagement Type"]?.toLowerCase();
        const allottedUserName = row["Allotted User"]?.toLowerCase();
        const dueDate = row["Due Date"];
        
        const client = clientName ? clientNameMap.get(clientName) : undefined;
        const engagementType = engagementTypeName ? engagementTypeNameMap.get(engagementTypeName) : undefined;
        const allottedUser = allottedUserName ? employeeNameMap.get(allottedUserName) : undefined;
        
        let parsedDate: Date | undefined;
        if (dueDate) {
            try {
                const formatsToTry = ['dd/MM/yyyy', 'dd-MM-yyyy'];
                let dateParsed = false;
                for (const formatStr of formatsToTry) {
                    const date = parse(dueDate, formatStr, new Date());
                    if (!isNaN(date.getTime())) {
                        parsedDate = date;
                        dateParsed = true;
                        break;
                    }
                }
                if (!dateParsed) throw new Error("Invalid date format");
            } catch {
                errors["Due Date"] = `Invalid date format. Use DD/MM/YYYY or DD-MM-YYYY.`;
                action = "IGNORE";
            }
        }

        if (action !== "IGNORE") {
            if (!client) {
                errors["Client Name"] = `Client "${row["Client Name"]}" not found in master data.`;
            }
            if (!engagementType) {
                errors["Engagement Type"] = `Type "${row["Engagement Type"]}" not found in master data.`;
            }
            if (!allottedUser) {
                errors["Allotted User"] = `Employee "${row["Allotted User"]}" not found in master data.`;
            }
        }
        
        if (Object.keys(errors).length > 0) {
            action = "IGNORE";
        }
        
        result.rows.push({ row, action, errors, client, engagementType, allottedUser, parsedDate, originalIndex: rowIndex });
    });

    result.summary.creates = result.rows.filter(r => r.action === "CREATE").length;
    result.summary.ignores = result.rows.filter(r => r.action === "IGNORE").length;

    setValidationResult(result);
    setIsValidating(false);

    if (result.rows.some(r => r.action === "IGNORE")) {
        setIsFiltered(true);
    }
     toast({
        title: "Validation Complete",
        description: `Found ${result.summary.creates} new engagements to create and ${result.summary.ignores} rows with errors.`,
     });
  };

  const handleImport = async () => {
    if (!validationResult) return;
    setIsImporting(true);

    const batch = writeBatch(db);
    validationResult.rows.forEach(row => {
        if (row.action === "CREATE" && row.client && row.engagementType && row.allottedUser && row.parsedDate) {
            const newEngagementDocRef = doc(collection(db, 'engagements'));
            const newEngagementData: Engagement = {
                id: newEngagementDocRef.id,
                clientId: row.client.id,
                type: row.engagementType.id,
                assignedTo: row.allottedUser.id,
                remarks: row.row["Remarks"] || row.engagementType.name,
                dueDate: row.parsedDate.toISOString(),
                status: 'Pending',
                reportedTo: '', // Can be updated later
            };
            batch.set(newEngagementDocRef, newEngagementData);

            // Create sub-tasks from template
             const subTaskTitles = row.engagementType.subTaskTitles || ["Task 1", "Task 2"];
             subTaskTitles.forEach((title, index) => {
                const taskDocRef = doc(collection(db, 'tasks'));
                const newTask: Task = {
                    id: taskDocRef.id,
                    engagementId: newEngagementDocRef.id,
                    title,
                    status: 'Pending',
                    order: index + 1,
                };
                batch.set(taskDocRef, newTask);
            });
        }
    });

    try {
        await batch.commit();
        toast({
            title: "Import Complete",
            description: `${validationResult.summary.creates} engagements and their tasks created successfully.`,
        });
        setIsValidationDialogOpen(false);
    } catch (error) {
        console.error("Error during bulk creation import:", error);
        toast({
            title: "Import Failed",
            description: "Could not create engagements.",
            variant: "destructive",
        });
    } finally {
        setIsImporting(false);
        setIsConfirmOpen(false);
    }
  }

  const headers = ASSIGNMENT_HEADERS;
  const displayedData = isFiltered && validationResult
    ? parsedData.filter((_, rowIndex) => validationResult.rows.some(r => r.originalIndex === rowIndex && r.action === "IGNORE"))
    : parsedData;

  const getOriginalIndex = (filteredIndex: number) => {
      if (!isFiltered || !validationResult) return filteredIndex;
      const rowData = displayedData[filteredIndex];
      return parsedData.indexOf(rowData);
  }
  
  const hasErrors = validationResult && validationResult.summary.ignores > 0;
  
  const totalErrorRows = validationResult?.rows.filter(r => r.action === "IGNORE").length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Create Engagements</CardTitle>
        <CardDescription>
          Upload a CSV to create new work engagements for your team. Fields with * are mandatory.
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
                config={{ skipEmptyLines: true, header: true }}
            >
            {({ getRootProps, acceptedFile, ProgressBar, getRemoveFileProps }: any) => {
                const removeFile = (e?: React.MouseEvent<HTMLButtonElement>) => {
                    if (e) e.stopPropagation();
                    setParsedData([]);
                    setValidationResult(null);
                    (getRemoveFileProps() as any).onClick(e);
                };

                const handleDialogClose = (open: boolean) => {
                    if (!open) {
                        setIsValidationDialogOpen(false);
                        removeFile();
                    } else {
                        setIsValidationDialogOpen(true);
                    }
                };
                
                return (
                    <>
                        <Card {...getRootProps()} className="p-8 border-dashed flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary transition-colors">
                            <Upload className="h-12 w-12 text-muted-foreground" />
                            {acceptedFile ? (
                                <>
                                    <p className="mt-4 text-muted-foreground">
                                        File <span className="font-semibold text-primary">{acceptedFile.name}</span> selected.
                                    </p>
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
                            <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col">
                                <DialogHeader>
                                    <DialogTitle>Validate and Create Engagements</DialogTitle>
                                    <DialogDescription>
                                        Review the data. Click "Validate Data" to check for errors, then import. Rows with errors will be highlighted in red.
                                    </DialogDescription>
                                </DialogHeader>
                                <TooltipProvider>
                                    <div className="flex-grow overflow-hidden">
                                        <ScrollArea className="flex-grow rounded-md border relative h-full">
                                            <Table>
                                                <TableHeader className="sticky top-0 bg-muted z-10">
                                                    <TableRow>
                                                        <TableHead>Row</TableHead>
                                                        {headers.map(header => <TableHead key={header}>{header}</TableHead>)}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {displayedData.map((row, index) => {
                                                        const originalRowIndex = getOriginalIndex(index);
                                                        const validationRow = validationResult?.rows.find(r => r.originalIndex === originalRowIndex);
                                                        return (
                                                            <TableRow key={originalRowIndex} className={cn(validationRow?.action === 'CREATE' && 'bg-green-500/10', validationRow?.action === 'IGNORE' && 'bg-red-500/10')}>
                                                                <TableCell className="px-4">{originalRowIndex + 1}</TableCell>
                                                                {headers.map(header => {
                                                                    const cellError = validationRow?.errors[header];
                                                                    const cellContent = <div className="max-w-[200px] truncate">{String(row[header] ?? '')}</div>;
                                                                    return (
                                                                        <TableCell key={header}>
                                                                            {cellError ? (
                                                                                <Tooltip delayDuration={100}>
                                                                                    <TooltipTrigger asChild>
                                                                                        <div className={cn("px-4 py-2 w-full h-full bg-red-500/20 cursor-help")}>{cellContent}</div>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent><p className="text-destructive">{cellError}</p></TooltipContent>
                                                                                </Tooltip>
                                                                            ) : (
                                                                                <div className="px-4 py-2">{cellContent}</div>
                                                                            )}
                                                                        </TableCell>
                                                                    )
                                                                })}
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </ScrollArea>
                                    </div>
                                    <DialogFooter className="pt-4 flex-shrink-0">
                                         <div className="text-sm text-muted-foreground mr-auto flex items-center">
                                            {validationResult !== null ? (
                                                isFiltered && totalErrorRows > 0 ? (
                                                    <>
                                                        <span>Showing {totalErrorRows} of {parsedData.length} rows with errors.</span>
                                                        <Button variant="link" size="sm" onClick={() => setIsFiltered(false)} className="p-1 h-auto">Show all</Button>
                                                    </>
                                                ) : `Showing all ${parsedData.length} records.`
                                            ) : `Showing all ${parsedData.length} records.`}
                                        </div>
                                        <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                        <Button onClick={handleValidate} disabled={isValidating}>{isValidating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validating...</> : 'Validate Data'}</Button>
                                         <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                                            <AlertDialogTrigger asChild>
                                                <Button disabled={!validationResult || isImporting} onClick={() => setIsConfirmOpen(true)}>
                                                    {isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : 'Import Data'}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirm Import</AlertDialogTitle>
                                                     <div className="text-sm text-muted-foreground py-4">
                                                        <ul className="list-disc pl-5 mt-2 space-y-1">
                                                            <li><b>{validationResult?.summary.creates || 0}</b> new engagements will be created.</li>
                                                            <li><b>{validationResult?.summary.ignores || 0}</b> rows with errors will be ignored.</li>
                                                        </ul>
                                                        <div className="mt-4">Do you want to proceed?</div>
                                                    </div>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleImport}>Yes, Import</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
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
