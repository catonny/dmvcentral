
"use client";

import * as React from "react";
import { Button } from "../ui/button";
import { Download, Upload, Loader2 } from "lucide-react";
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
import { writeBatch, doc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ScrollArea } from "../ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const EMPLOYEE_HEADERS = ["Name", "Email", "Designation", "Role", "leaveAllowance"];
const MANDATORY_EMPLOYEE_HEADERS = ["Name", "Email", "Role"];

interface BulkCreateEmployeesProps {
    allDepartments: Department[];
}

interface ValidatedRow {
    row: any;
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

export function BulkCreateEmployees({ allDepartments }: BulkCreateEmployeesProps) {
  const [parsedData, setParsedData] = React.useState<any[]>([]);
  const [isValidationDialogOpen, setIsValidationDialogOpen] = React.useState(false);
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null);
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
    const existingEmails = new Set(existingEmployeesSnapshot.docs.map(doc => doc.data().email.toLowerCase()));
    const validRoles = new Set(allDepartments.map(d => d.name));

    const result: ValidationResult = {
        rows: [],
        summary: { creates: 0, ignores: 0 }
    };

    parsedData.forEach((row, rowIndex) => {
        const errors: { [key: string]: string } = {};
        let action: "CREATE" | "IGNORE" = "CREATE";

        // Check for mandatory fields
        MANDATORY_EMPLOYEE_HEADERS.forEach(header => {
            if (!row[header] || String(row[header]).trim() === '') {
                errors[header] = `Mandatory field is missing.`;
                action = "IGNORE";
            }
        });

        // Validate email format and uniqueness
        if (row["Email"]) {
            if (!emailRegex.test(row["Email"])) {
                errors["Email"] = `Invalid email format.`;
                action = "IGNORE";
            } else if (existingEmails.has(row["Email"].toLowerCase())) {
                errors["Email"] = `An employee with this email already exists.`;
                action = "IGNORE";
            }
        }
        
        // Validate Role
        if (row["Role"] && !validRoles.has(row["Role"])) {
            errors["Role"] = `Role '${row["Role"]}' is not a valid department.`;
            action = "IGNORE";
        }
        
        result.rows.push({ row, action, errors, originalIndex: rowIndex });
    });

    result.summary.creates = result.rows.filter(r => r.action === "CREATE").length;
    result.summary.ignores = result.rows.filter(r => r.action === "IGNORE").length;

    setValidationResult(result);
    setIsValidating(false);

     toast({
        title: "Validation Complete",
        description: `Found ${result.summary.creates} new employees to create and ${result.summary.ignores} rows with errors.`,
     });
  };

  const handleImport = async () => {
    if (!validationResult) return;
    setIsImporting(true);

    const batch = writeBatch(db);
    const rowsToCreate = validationResult.rows.filter(r => r.action === "CREATE");
    
    rowsToCreate.forEach(({ row }) => {
        const newEmployeeDocRef = doc(collection(db, 'employees'));
        const newEmployeeData: Omit<Employee, 'id'> = {
            name: row["Name"],
            email: row["Email"],
            designation: row["Designation"] || "",
            role: [row["Role"]], // Role is stored as an array
            avatar: `https://placehold.co/40x40.png`,
            leaveAllowance: Number(row["leaveAllowance"]) || 18,
            leavesTaken: 0,
        };
        batch.set(newEmployeeDocRef, { ...newEmployeeData, id: newEmployeeDocRef.id });
    });

    try {
        await batch.commit();
        toast({
            title: "Import Complete",
            description: `${rowsToCreate.length} employees created successfully.`,
        });
        setIsValidationDialogOpen(false);
    } catch (error) {
        console.error("Error during bulk employee import:", error);
        toast({
            title: "Import Failed",
            description: "Could not create employees.",
            variant: "destructive",
        });
    } finally {
        setIsImporting(false);
    }
  }
  
  const handleDialogClose = (open: boolean) => {
    if (!open) {
        setIsValidationDialogOpen(false);
        setParsedData([]);
        setValidationResult(null);
    } else {
        setIsValidationDialogOpen(true);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Create Employees</CardTitle>
        <CardDescription>
          Upload a CSV to add new employees to the system. Fields with * are mandatory.
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
                                                        return (
                                                            <TableRow key={index} className={cn(validationRow?.action === 'CREATE' && 'bg-green-500/10', validationRow?.action === 'IGNORE' && 'bg-red-500/10')}>
                                                                {EMPLOYEE_HEADERS.map(header => {
                                                                    const cellError = validationRow?.errors[header];
                                                                    const cellContent = <div className="max-w-[200px] truncate">{String(row[header] ?? '')}</div>;
                                                                    return (
                                                                        <TableCell key={header}>
                                                                            {cellError ? (
                                                                                <Tooltip delayDuration={100}>
                                                                                    <TooltipTrigger asChild>
                                                                                        <div className={cn("p-2 w-full h-full bg-red-500/20 cursor-help")}>{cellContent}</div>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent><p className="text-destructive">{cellError}</p></TooltipContent>
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
                                    <DialogFooter>
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
