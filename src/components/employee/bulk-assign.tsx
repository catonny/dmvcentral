
"use client";

import * as React from "react";
import { Button } from "../ui/button";
import { Download, Upload, AlertTriangle, DatabaseBackup, SkipForward } from "lucide-react";
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
import type { Engagement, EngagementType, Client, Employee, Task, EngagementStatus } from "@/lib/data";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { writeBatch, doc, collection, getDocs, query, where } from "firebase/firestore";
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
import { format, parse, isValid } from "date-fns";
import { engagementStatuses } from "../reports/engagement-statuses";

const ASSIGNMENT_HEADERS = ["Engagement Type", "Client Name", "Due Date", "Allotted User", "Reported To", "Status", "Fees", "Remarks"];
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
    reporter?: Employee;
    parsedDate?: Date;
    status?: EngagementStatus;
    fees?: number;
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

export function BulkCreateEngagements({ allEmployees, allClients, allEngagementTypes }: BulkCreateEngagementsProps) {
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
    const headers = ASSIGNMENT_HEADERS.map(h => MANDATORY_ASSIGNMENT_HEADERS.includes(h) ? `${h}*` : h);
    
    const dummyData = [
        {
            "Engagement Type*": "ITR Filing",
            "Client Name*": "Innovate Inc.",
            "Due Date*": "31/07/2024",
            "Allotted User*": "Dojo Davis",
            "Reported To": "Dojo Davis",
            "Status": "Pending",
            "Fees": "5000",
            "Remarks": "ITR for Innovate Inc. for Assessment Year 2024-25"
        },
        {
            "Engagement Type*": "GST Filing",
            "Client Name*": "GreenFuture LLP",
            "Due Date*": "20/07/2024",
            "Allotted User*": "Dojo Davis",
            "Reported To": "Dojo Davis",
            "Status": "In Process",
            "Fees": "8000",
            "Remarks": "Monthly GST returns for June 2024"
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

    // Existing data maps
    const clientNameMap = new Map(allClients.map(c => [c.Name.toLowerCase(), c]));
    const employeeNameMap = new Map(allEmployees.map(e => [e.name.toLowerCase(), e]));
    const engagementTypeNameMap = new Map(allEngagementTypes.map(et => [et.name.toLowerCase(), et]));
    
    // Fetch existing engagements to check for duplicates
    const engagementsSnapshot = await getDocs(query(collection(db, "engagements"), where("status", "!=", "Completed")));
    const existingEngagements = engagementsSnapshot.docs.map(doc => doc.data() as Engagement);
    const existingEngagementKeys = new Set(existingEngagements.map(e => `${e.clientId}_${e.type}_${e.assignedTo.join(',')}`));

    const result: ValidationResult = {
        rows: [],
        summary: { creates: 0, ignores: 0, duplicates: 0 }
    };
    
    const processedInCsv = new Set<string>();

    parsedData.forEach((row, rowIndex) => {
        const errors: { [key: string]: string } = {};
        let action: "CREATE" | "IGNORE" | "DUPLICATE" = "CREATE";
        let duplicateReason = "";

        // Mandatory fields check
        MANDATORY_ASSIGNMENT_HEADERS.forEach(header => {
            if (!row[header] || String(row[header]).trim() === '') {
                errors[header] = `Mandatory field is missing.`;
                action = "IGNORE";
            }
        });
        
        if (action === "IGNORE") {
             result.rows.push({ row, action, errors, originalIndex: rowIndex, duplicateReason });
             return;
        }

        const clientName = row["Client Name"]?.toLowerCase();
        const engagementTypeName = row["Engagement Type"]?.toLowerCase();
        const allottedUserName = row["Allotted User"]?.toLowerCase();
        
        const client = clientName ? clientNameMap.get(clientName) : undefined;
        const engagementType = engagementTypeName ? engagementTypeNameMap.get(engagementTypeName) : undefined;
        const allottedUser = allottedUserName ? employeeNameMap.get(allottedUserName) : undefined;
        
        // CSV duplicate check
        const csvKey = `${client?.id}_${engagementType?.id}_${allottedUser?.id}`;
        if (processedInCsv.has(csvKey)) {
            action = "DUPLICATE";
            duplicateReason = "This is a duplicate of another row in the same CSV file.";
        } else {
            processedInCsv.add(csvKey);
        }

        // DB duplicate check
        if (client && engagementType && allottedUser) {
             const dbKey = `${client.id}_${engagementType.id}_${allottedUser.id}`;
             if(existingEngagementKeys.has(dbKey)) {
                 action = "DUPLICATE";
                 duplicateReason = "An active engagement with this client, type, and user already exists.";
             }
        }

        // Data validation
        if (!client) errors["Client Name"] = `Client "${row["Client Name"]}" not found.`;
        if (!engagementType) errors["Engagement Type"] = `Type "${row["Engagement Type"]}" not found.`;
        if (!allottedUser) errors["Allotted User"] = `User "${row["Allotted User"]}" not found.`;
        
        let parsedDate;
        try {
            const dateStr = row["Due Date"];
            if (!dateStr) {
                throw new Error("Date is missing");
            }
            parsedDate = parse(dateStr, 'dd/MM/yyyy', new Date());
            if (!isValid(parsedDate)) {
                throw new Error("Invalid date found");
            }
        } catch {
            errors["Due Date"] = "Invalid date format. Use DD/MM/YYYY.";
        }
        
        if (Object.keys(errors).length > 0) {
            action = "IGNORE";
        }

        result.rows.push({
            row, action, errors, client, engagementType, allottedUser, parsedDate,
            reporter: row["Reported To"] ? employeeNameMap.get(row["Reported To"].toLowerCase()) : undefined,
            status: row["Status"] && engagementStatuses.includes(row["Status"]) ? row["Status"] : "Pending",
            fees: row["Fees"] ? parseFloat(row["Fees"]) : 0,
            originalIndex: rowIndex,
            duplicateReason
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

    if (result.summary.ignores > 0 || result.summary.duplicates > 0) {
        setIsFiltered(true);
    }
     toast({
        title: "Validation Complete",
        description: `Found ${result.summary.creates} new, ${result.summary.duplicates} duplicates, and ${result.summary.ignores} rows with errors.`,
     });
  };

  const handleImport = async (skipDuplicates: boolean) => {
    if (!validationResult) return;
    setIsImporting(true);

    const rowsToImport = validationResult.rows.filter(r => 
        r.action === "CREATE" || (r.action === "DUPLICATE" && !skipDuplicates)
    );

    if (rowsToImport.length === 0) {
        toast({ title: "No Data to Import", description: "No valid records to import."});
        setIsImporting(false);
        return;
    }

    const batch = writeBatch(db);
    rowsToImport.forEach(rowToImport => {
        const { row, client, engagementType, allottedUser, reporter, parsedDate, status, fees } = rowToImport;
        if (client && engagementType && allottedUser && parsedDate) {
            const newEngagementDocRef = doc(collection(db, 'engagements'));
            const newEngagementData: Partial<Engagement> = {
                id: newEngagementDocRef.id,
                clientId: client.id,
                type: engagementType.id,
                assignedTo: [allottedUser.id],
                remarks: row["Remarks"] || engagementType.name,
                dueDate: parsedDate.toISOString(),
                status: status || 'Pending',
                reportedTo: reporter ? reporter.id : '',
                fees: fees || 0
            };
            batch.set(newEngagementDocRef, newEngagementData);

             const subTaskTitles = engagementType.subTaskTitles || ["Task 1", "Task 2"];
             subTaskTitles.forEach((title, index) => {
                const taskDocRef = doc(collection(db, 'tasks'));
                const newTask: Task = {
                    id: taskDocRef.id,
                    engagementId: newEngagementDocRef.id,
                    title,
                    status: 'Pending',
                    order: index + 1,
                    assignedTo: allottedUser!.id,
                };
                batch.set(taskDocRef, newTask);
            });
        }
    });

    try {
        await batch.commit();
        toast({
            title: "Import Complete",
            description: `${rowsToImport.length} engagements and their tasks created successfully.`,
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
    }
  }

  const handleDownloadInvalid = () => {
    if (!validationResult) return;

    const invalidRows = validationResult.rows
      .filter(r => r.action === 'IGNORE' || r.action === 'DUPLICATE')
      .map(r => {
        const errorReason = r.duplicateReason || Object.values(r.errors).join('; ');
        return { ...r.row, 'Error Reason': errorReason };
      });

    if (invalidRows.length === 0) {
      toast({ title: "No Invalid Rows", description: "There are no rows with errors or duplicates to download." });
      return;
    }

    const csv = Papa.unparse(invalidRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'invalid_engagement_rows.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const headers = ASSIGNMENT_HEADERS;
  const displayedData = isFiltered && validationResult
    ? parsedData.filter((_, rowIndex) => validationResult.rows.some(r => r.originalIndex === rowIndex && r.action !== "CREATE"))
    : parsedData;

  const getOriginalIndex = (filteredIndex: number) => {
      if (!isFiltered || !validationResult) return filteredIndex;
      const rowData = displayedData[filteredIndex];
      return parsedData.indexOf(rowData);
  }
  
  const totalIssueRows = validationResult?.rows.filter(r => r.action !== "CREATE").length || 0;
  
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
                                        Review the data. Click "Validate Data" to check for errors, then import.
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
                                                        const rowClass = {
                                                            "CREATE": "bg-green-500/10",
                                                            "IGNORE": "bg-red-500/20",
                                                            "DUPLICATE": "bg-yellow-500/20"
                                                        }[validationRow?.action || ""] || "";
                                                        
                                                        const tooltipText = validationRow?.duplicateReason || Object.values(validationRow?.errors || {}).join(' | ');

                                                        return (
                                                            <TableRow key={originalRowIndex} className={rowClass}>
                                                                <TableCell className="px-4">{originalRowIndex + 1}</TableCell>
                                                                {headers.map(header => {
                                                                    const cellContent = <div className="max-w-[200px] truncate">{String(row[header] ?? '')}</div>;
                                                                    return (
                                                                        <TableCell key={header}>
                                                                            {tooltipText ? (
                                                                                <Tooltip delayDuration={100}>
                                                                                    <TooltipTrigger asChild>
                                                                                        <div className={cn("px-4 py-2 w-full h-full cursor-help", validationRow?.errors[header] && "bg-red-500/20")}>{cellContent}</div>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent><p className="text-destructive">{tooltipText}</p></TooltipContent>
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
                                    <DialogFooter className="pt-4 flex-shrink-0 flex-wrap gap-2">
                                         <div className="text-sm text-muted-foreground mr-auto flex items-center">
                                            {validationResult !== null ? (
                                                isFiltered && totalIssueRows > 0 ? (
                                                    <>
                                                        <span>Showing {totalIssueRows} of {parsedData.length} rows with issues.</span>
                                                        <Button variant="link" size="sm" onClick={() => setIsFiltered(false)} className="p-1 h-auto">Show all</Button>
                                                    </>
                                                ) : `Showing all ${parsedData.length} records.`
                                            ) : `Showing all ${parsedData.length} records.`}
                                        </div>
                                        <div className="flex gap-2">
                                            {validationResult && totalIssueRows > 0 && (
                                                <Button variant="secondary" onClick={handleDownloadInvalid}>
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Download Invalid Rows
                                                </Button>
                                            )}
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
                                                        <div className="text-sm text-muted-foreground py-4">
                                                            <ul className="list-disc pl-5 mt-2 space-y-1">
                                                                <li><b>{validationResult?.summary.creates || 0}</b> new engagements will be created.</li>
                                                                <li><b>{validationResult?.summary.duplicates || 0}</b> duplicates found.</li>
                                                                <li><b>{validationResult?.summary.ignores || 0}</b> rows with errors will be ignored.</li>
                                                            </ul>
                                                        </div>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        {(validationResult?.summary.duplicates || 0) > 0 ? (
                                                            <>
                                                                <Button variant="destructive" onClick={() => handleImport(false)}>Overwrite Duplicates</Button>
                                                                <AlertDialogAction onClick={() => handleImport(true)}>Skip Duplicates</AlertDialogAction>
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
