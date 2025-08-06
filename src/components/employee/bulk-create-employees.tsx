
"use client";

import * as React from "react";
import { Button } from "../ui/button";
import { Download, Upload, Loader2, AlertTriangle, SkipForward, DatabaseBackup } from "lucide-react";
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
import type { Department, Employee } from "@/lib/data";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "@/lib/utils";
import { writeBatch, doc, collection, getDocs, query, where, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ScrollArea } from "../ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const EMPLOYEE_HEADERS = ["Name", "Email", "Designation", "Role", "leaveAllowance"];
const MANDATORY_EMPLOYEE_HEADERS = ["Name", "Email", "Role"];

interface BulkCreateEmployeesProps {
    allDepartments: Department[];
}

type RowAction = "CREATE" | "UPDATE" | "IGNORE" | "DUPLICATE";

interface ValidatedRow {
    row: any;
    errors: { [key: string]: string };
    originalIndex: number;
    action: RowAction;
    existingEmployeeId?: string;
}

interface ValidationResult {
    rows: ValidatedRow[];
    summary: {
        creates: number;
        updates: number;
        ignores: number;
        duplicates: number;
    }
}

export function BulkCreateEmployees({ allDepartments }: BulkCreateEmployeesProps) {
  const [parsedData, setParsedData] = React.useState<any[]>([]);
  const [isValidationDialogOpen, setIsValidationDialogOpen] = React.useState(false);
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [isFiltered, setIsFiltered] = React.useState(false);
  
  const { CSVReader } = useCSVReader();
  const { toast } = useToast();

  React.useEffect(() => {
    if (parsedData.length > 0) {
      setIsValidationDialogOpen(true);
    }
  }, [parsedData]);
  
  const handleDownloadTemplate = () => {
    const headers = EMPLOYEE_HEADERS.map(h => MANDATORY_EMPLOYEE_HEADERS.includes(h) ? `${h}*` : h);
    
    const dummyData = [
        {
            "Name*": "Ravi Kumar",
            "Email*": "ravi.kumar@example.com",
            "Designation": "Senior Accountant",
            "Role*": "Employee",
            "leaveAllowance": "18"
        },
        {
            "Name*": "Priya Sharma",
            "Email*": "priya.sharma@example.com",
            "Designation": "Audit Assistant",
            "Role*": "Articles",
            "leaveAllowance": "12"
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
    link.setAttribute("download", `bulk_employee_creation_template.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: "Success", description: `Bulk employee creation template downloaded.` });
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const existingEmployeesSnapshot = await getDocs(query(collection(db, "employees")));
    const existingEmployees = existingEmployeesSnapshot.docs.map(d => d.data() as Employee);
    const emailToIdMap = new Map(existingEmployees.map(e => [e.email.toLowerCase(), e.id]));
    const validRoles = new Set(allDepartments.map(d => d.name));

    const result: ValidationResult = {
        rows: [],
        summary: { creates: 0, updates: 0, ignores: 0, duplicates: 0 }
    };
    
    const processedEmailsInCsv = new Set<string>();

    parsedData.forEach((row, rowIndex) => {
        const errors: { [key: string]: string } = {};
        let action: RowAction = "CREATE";
        let existingEmployeeId: string | undefined;

        const email = row["Email"]?.toLowerCase();

        if (email && processedEmailsInCsv.has(email)) {
            action = "DUPLICATE";
        } else if (email) {
            processedEmailsInCsv.add(email);
            if (emailToIdMap.has(email)) {
                action = "UPDATE";
                existingEmployeeId = emailToIdMap.get(email);
            }
        }

        // Validate mandatory fields
        MANDATORY_EMPLOYEE_HEADERS.forEach(header => {
            if (!row[header] || String(row[header]).trim() === '') {
                errors[header] = `Mandatory field is missing.`;
                action = "IGNORE";
            }
        });

        // Other validations
        if (row["Email"] && !emailRegex.test(row["Email"])) {
            errors["Email"] = `Invalid email format.`;
            action = "IGNORE";
        }
        if (row["Role"] && !validRoles.has(row["Role"])) {
            errors["Role"] = `Role '${row["Role"]}' is not a valid department.`;
            action = "IGNORE";
        }
        
        result.rows.push({ row, action, errors, originalIndex: rowIndex, existingEmployeeId });
    });

    result.summary = result.rows.reduce((acc, r) => {
        if(r.action === "CREATE") acc.creates++;
        else if(r.action === "UPDATE") acc.updates++;
        else if(r.action === "IGNORE") acc.ignores++;
        else if(r.action === "DUPLICATE") acc.duplicates++;
        return acc;
    }, {creates: 0, updates: 0, ignores: 0, duplicates: 0});

    setValidationResult(result);
    setIsValidating(false);

    if (result.summary.ignores > 0 || result.summary.duplicates > 0) {
        setIsFiltered(true);
    }
     toast({
        title: "Validation Complete",
        description: `Found ${result.summary.creates} new, ${result.summary.updates} updates, ${result.summary.duplicates} duplicates, and ${result.summary.ignores} ignored records.`,
     });
  };

  const handleImport = async (skipDuplicates: boolean) => {
    if (!validationResult) return;
    setIsImporting(true);

    const rowsToProcess = validationResult.rows.filter(r => 
        r.action !== "IGNORE" && (r.action !== "DUPLICATE" || !skipDuplicates)
    );

    if (rowsToProcess.length === 0) {
        toast({ title: "No Data to Import", description: "No valid records to import."});
        setIsImporting(false);
        return;
    }
    
    const batch = writeBatch(db);
    
    rowsToProcess.forEach(({ row, action, existingEmployeeId }) => {
        const employeeData: Omit<Employee, 'id'> = {
            name: row["Name"],
            email: row["Email"],
            designation: row["Designation"] || "",
            role: [row["Role"]],
            avatar: `https://placehold.co/40x40.png`,
            leaveAllowance: Number(row["leaveAllowance"]) || 18,
            leavesTaken: 0,
        };
        
        if (action === "CREATE" || (action === "DUPLICATE" && !skipDuplicates)) {
            const newEmployeeDocRef = doc(collection(db, 'employees'));
            batch.set(newEmployeeDocRef, { ...employeeData, id: newEmployeeDocRef.id });
        } else if (action === "UPDATE" && existingEmployeeId) {
            const employeeRef = doc(db, 'employees', existingEmployeeId);
            batch.update(employeeRef, employeeData);
        }
    });

    try {
        await batch.commit();
        toast({
            title: "Import Complete",
            description: `${rowsToProcess.length} employee records created or updated successfully.`,
        });
        setIsValidationDialogOpen(false);
    } catch (error) {
        console.error("Error during bulk employee import:", error);
        toast({
            title: "Import Failed",
            description: "Could not process employees.",
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
        const errorReason = Object.values(r.errors).join('; ');
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
    link.download = 'invalid_employee_rows.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleDialogClose = (open: boolean) => {
    if (!open) {
        setIsValidationDialogOpen(false);
        setParsedData([]);
        setValidationResult(null);
    }
  };

  const totalIssueRows = validationResult?.rows.filter(r => r.action !== "CREATE" && r.action !== "UPDATE").length || 0;


  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Create Employees</CardTitle>
        <CardDescription>
          Upload a CSV to add or update employees in the system. Fields with * are mandatory.
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
                                    <DialogTitle>Validate and Create Employees</DialogTitle>
                                    <DialogDescription>
                                        Review the data. Click "Validate" to check for errors, then import.
                                    </DialogDescription>
                                </DialogHeader>
                                <TooltipProvider>
                                    <div className="flex-grow overflow-hidden">
                                        <ScrollArea className="h-full rounded-md border">
                                            <Table>
                                                <TableHeader className="sticky top-0 bg-muted z-10">
                                                    <TableRow>
                                                        {EMPLOYEE_HEADERS.map(header => <TableHead key={header}>{header}</TableHead>)}
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {parsedData.map((row, index) => {
                                                        const validationRow = validationResult?.rows.find(r => r.originalIndex === index);
                                                         const rowClass = {
                                                            "CREATE": "bg-green-500/10",
                                                            "UPDATE": "bg-blue-500/10",
                                                            "IGNORE": "bg-red-500/20",
                                                            "DUPLICATE": "bg-yellow-500/20"
                                                        }[validationRow?.action || ""] || "";
                                                        
                                                        const tooltipText = Object.values(validationRow?.errors || {}).join(' | ');

                                                        return (
                                                            <TableRow key={index} className={rowClass}>
                                                                {EMPLOYEE_HEADERS.map(header => {
                                                                    const cellContent = <div className="max-w-[200px] truncate">{String(row[header] ?? '')}</div>;
                                                                    return (
                                                                        <TableCell key={header}>
                                                                            {tooltipText ? (
                                                                                <Tooltip delayDuration={100}>
                                                                                    <TooltipTrigger asChild>
                                                                                        <div className={cn("p-2 w-full h-full cursor-help", validationRow?.errors[header] && "bg-red-500/20")}>{cellContent}</div>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent><p className="text-destructive">{tooltipText}</p></TooltipContent>
                                                                                </Tooltip>
                                                                            ) : (
                                                                                <div className="p-2">{cellContent}</div>
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
                                    <DialogFooter className="pt-4 flex-wrap gap-2">
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
                                                                <li><b>{validationResult?.summary.creates || 0}</b> new employees will be created.</li>
                                                                <li><b>{validationResult?.summary.updates || 0}</b> employees will be updated.</li>
                                                                <li><b>{validationResult?.summary.duplicates || 0}</b> duplicates will be skipped.</li>
                                                                <li><b>{validationResult?.summary.ignores || 0}</b> rows with errors will be ignored.</li>
                                                            </ul>
                                                        </div>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleImport(true)}>Import Valid Data</AlertDialogAction>
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
