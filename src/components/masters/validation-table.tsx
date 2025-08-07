
"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { DialogFooter, DialogClose, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "@/lib/utils";
import { MANDATORY_CLIENT_HEADERS } from "./bulk-update-data";
import { Loader2, AlertTriangle, DatabaseBackup, SkipForward, Download } from "lucide-react";
import { writeBatch, collection, doc, getDocs, query, where, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Client, Employee, Firm } from "@/lib/data";
import Papa from "papaparse";

interface ValidationTableProps {
  data: any[];
  onComplete: () => void;
}

type RowAction = "CREATE" | "UPDATE" | "IGNORE" | "FIX_AND_CREATE" | "FIX_AND_UPDATE" | "DUPLICATE";

interface ValidationResult {
    rows: {
        row: any;
        action: RowAction;
        errors: { [key: string]: string };
        originalIndex: number;
        existingClientId?: string;
        partnerId?: string;
        firmId?: string;
        duplicateReason?: string;
    }[];
    summary: {
        creates: number;
        updates: number;
        ignores: number;
        duplicates: number;
    }
}


export function ValidationTable({ data, onComplete }: ValidationTableProps) {
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null);
  const [isFiltered, setIsFiltered] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [importMode, setImportMode] = React.useState<'skip' | 'overwrite' | null>(null);
  const [isInspectDialogOpen, setIsInspectDialogOpen] = React.useState(false);
  
  const { toast } = useToast();

  if (!data || data.length === 0) {
    return null;
  }

  const headers = Object.keys(data[0]);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


  const handleValidate = async () => {
    setIsValidating(true);
    setValidationResult(null);

    try {
        const [clientsSnapshot, employeesSnapshot, firmsSnapshot] = await Promise.all([
             getDocs(query(collection(db, "clients"))),
             getDocs(query(collection(db, "employees"))),
             getDocs(query(collection(db, "firms"))),
        ]);
        
        const existingClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        const allEmployees = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        const allFirms = firmsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Firm));
        
        const panToIdMap = new Map(existingClients.map(c => [c.pan, c.id]));
        const nameMobileToIdMap = new Map(existingClients.map(c => [`${c.name?.toLowerCase()}_${c.mobileNumber}`, c.id]));
        const partnerNameToIdMap = new Map(allEmployees.filter(e => e.role.includes("Partner")).map(e => [e.name.toLowerCase(), e.id]));
        const firmNameToIdMap = new Map(allFirms.map(f => [f.name.toLowerCase(), f.id]));


        const result: ValidationResult = {
            rows: [],
            summary: { creates: 0, updates: 0, ignores: 0, duplicates: 0 }
        };
        
        const processedInCsv = new Set<string>(); // To track duplicates within the CSV

        for (const [rowIndex, row] of data.entries()) {
            const rowErrors: { [key: string]: string } = {};
            let action: RowAction = "CREATE";
            let existingClientId: string | undefined = undefined;
            let duplicateReason: string | undefined;

            const pan = row['PAN']?.trim();
            const name = row['Name']?.trim().toLowerCase();
            const mobile = row['Mobile Number']?.trim();
            
            const nameMobileKey = `${name}_${mobile}`;
            const panKey = pan;

            // Check for duplicates within the CSV itself
            if (pan && pan !== 'PANNOTAVLBL' && processedInCsv.has(panKey)) {
                action = "DUPLICATE";
                duplicateReason = `Duplicate PAN (${pan}) found in CSV at an earlier row.`;
            } else if (processedInCsv.has(nameMobileKey)) {
                action = "DUPLICATE";
                duplicateReason = `Duplicate Name + Mobile combination found in CSV at an earlier row.`;
            } else {
                // If not a CSV duplicate, check against the database
                if (pan && pan !== 'PANNOTAVLBL' && panToIdMap.has(pan)) {
                    action = "UPDATE";
                    existingClientId = panToIdMap.get(pan);
                } else if (name && mobile && nameMobileToIdMap.has(nameMobileKey)) {
                    action = "UPDATE";
                    existingClientId = nameMobileToIdMap.get(nameMobileKey);
                }
            }

            // Mark as processed to catch subsequent duplicates in the file
            if (action !== "DUPLICATE") {
                 if (pan && pan !== 'PANNOTAVLBL') processedInCsv.add(panKey);
                 if (name && mobile) processedInCsv.add(nameMobileKey);
            }

            let partnerId: string | undefined;
            if (row['Partner']) {
                partnerId = partnerNameToIdMap.get(row['Partner'].toLowerCase());
                if (!partnerId) {
                    rowErrors['Partner'] = `Partner '${row['Partner']}' not found in employees.`;
                }
            }
            
            let firmId: string | undefined;
            if (row['Firm Name']) {
                firmId = firmNameToIdMap.get(row['Firm Name'].toLowerCase());
                if (!firmId) {
                    rowErrors['Firm Name'] = `Firm '${row['Firm Name']}' not found.`;
                }
            }


            if (action !== "DUPLICATE") {
                 if (!row['Name'] || String(row['Name']).trim() === '') {
                    rowErrors['Name'] = "Name is a mandatory field and cannot be empty. This row will be ignored.";
                    action = "IGNORE";
                } else {
                    MANDATORY_CLIENT_HEADERS.forEach(header => {
                        if (header !== 'Name' && (!row[header] || String(row[header]).trim() === '')) {
                            rowErrors[header] = `Mandatory field '${header}' is missing. It will be set to a default placeholder value.`;
                        }
                    });

                    if (row['Mail ID'] && !emailRegex.test(row['Mail ID'])) {
                        rowErrors['Mail ID'] = 'Invalid email format. It will be set to "unassigned".';
                    }

                    if (!row['PAN'] && action === "CREATE") { // Only error on missing PAN for new clients
                        rowErrors['PAN'] = 'PAN is missing. It will be set to "PANNOTAVLBL" for now. Please update it later.';
                    }
                }

                if (action !== "IGNORE" && Object.keys(rowErrors).length > 0) {
                    action = action.includes("UPDATE") ? "FIX_AND_UPDATE" : "FIX_AND_CREATE";
                }
            }
            
            result.rows.push({ row, action, errors: rowErrors, originalIndex: rowIndex, existingClientId, partnerId, firmId, duplicateReason });
        }

        result.summary = result.rows.reduce((acc, r) => {
            if (r.action.includes("CREATE")) acc.creates++;
            else if (r.action.includes("UPDATE")) acc.updates++;
            else if (r.action === "DUPLICATE") acc.duplicates++;
            else if (r.action === "IGNORE") acc.ignores++;
            return acc;
        }, { creates: 0, updates: 0, ignores: 0, duplicates: 0 });

        setValidationResult(result);

        if (result.summary.ignores > 0 || result.summary.duplicates > 0) {
            setIsFiltered(true);
        }

        toast({
            title: "Validation Complete",
            description: `${result.summary.creates} new, ${result.summary.updates} updates, ${result.summary.duplicates} duplicates, and ${result.summary.ignores} ignored records found.`,
            variant: result.summary.ignores > 0 || result.summary.duplicates > 0 ? "destructive" : "default",
        })

    } catch (error) {
        console.error("Error during validation:", error);
        toast({ title: "Validation Failed", description: "Could not fetch existing client data for validation.", variant: "destructive"});
    } finally {
        setIsValidating(false);
    }
  };
  
  const handleImport = async (mode: 'skip' | 'overwrite' | null): Promise<void> => {
    if (!validationResult) {
        toast({ title: "Validation required", description: "Please validate the data before importing.", variant: "destructive"});
        return;
    }
    setImportMode(mode);

    let rowsToImport = validationResult.rows.filter(r => r.action !== "IGNORE");
    
    if (mode === 'skip') {
        rowsToImport = rowsToImport.filter(r => r.action !== 'DUPLICATE');
    }

    if (rowsToImport.length === 0) {
        toast({ title: "No data to import", description: "There are no valid records to import based on your selection.", variant: "destructive"});
        return;
    }

    setIsImporting(true);
    try {
        const batch = writeBatch(db);
        
        rowsToImport.forEach(({ row, action, existingClientId, partnerId, firmId, duplicateReason }) => {
            let isUpdate = action.includes("UPDATE");
            // If overwriting, treat duplicates as updates if they match a DB record
            if (mode === 'overwrite' && action === 'DUPLICATE' && !duplicateReason?.includes('CSV')) {
                const pan = row['PAN']?.trim();
                const name = row['Name']?.trim().toLowerCase();
                const mobile = row['Mobile Number']?.trim();
                const nameMobileKey = `${name}_${mobile}`;
                
                // This logic needs to be enhanced if we want to find the DB record to overwrite
                isUpdate = true;
            }

            const clientRef = isUpdate && existingClientId ? doc(db, 'clients', existingClientId) : doc(collection(db, 'clients'));

            const clientData: Partial<Client> = {
                ...row,
                name: row.Name,
                mailId: (!row['Mail ID'] || !emailRegex.test(row['Mail ID'])) ? 'unassigned' : row['Mail ID'],
                mobileNumber: !row['Mobile Number'] ? '1111111111' : row['Mobile Number'],
                pan: !row['PAN'] && !isUpdate ? 'PANNOTAVLBL' : row['PAN'],
                category: !row['Category'] ? 'unassigned' : row['Category'],
                partnerId: partnerId || "unassigned",
                firmId: firmId || "unassigned",
                linkedClientIds: row.linkedClientIds ? String(row.linkedClientIds).split(',').map(id => id.trim()) : [],
                lastUpdated: new Date().toISOString()
            };
            
            if (isUpdate) {
                 batch.update(clientRef, clientData);
            } else {
                 batch.set(clientRef, { ...clientData, id: clientRef.id, createdAt: new Date().toISOString() });
            }
        });

        await batch.commit();

        toast({
            title: "Import Complete",
            description: `Import finished successfully.`,
            duration: 10000,
        });
        onComplete();

    } catch (error) {
        console.error("Error importing data:", error);
        toast({ title: "Import Failed", description: "An error occurred while importing data.", variant: "destructive" });
    } finally {
        setIsImporting(false);
        setIsConfirmOpen(false);
    }
  };

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
    link.download = 'invalid_client_rows.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCellAction = (rowIndex: number): RowAction | null => {
    const resultRow = validationResult?.rows.find(r => r.originalIndex === rowIndex);
    return resultRow ? resultRow.action : null;
  }
  
  const getCellTooltip = (rowIndex: number): string | null => {
      if (!validationResult) return null;
      const resultRow = validationResult.rows.find(r => r.originalIndex === rowIndex);
      if (!resultRow) return null;

      const errors = Object.values(resultRow.errors).join(' | ');
      if (resultRow.action === "DUPLICATE") return resultRow.duplicateReason || "Duplicate record";
      if (errors) return errors;

      const actionText = {
            "CREATE": "Will be created as a new client.",
            "UPDATE": "Will update an existing client.",
            "IGNORE": "Will be ignored due to fatal errors.",
            "FIX_AND_CREATE": "Will be created with placeholder values for some fields.",
            "FIX_AND_UPDATE": "Will update an existing client with placeholder values for some fields.",
      }[resultRow.action];

      return actionText || null;
  }

  const displayedData = isFiltered && validationResult
    ? data.filter((_, rowIndex) => validationResult.rows.some(r => r.originalIndex === rowIndex && (r.action === "IGNORE" || r.action === "DUPLICATE" || Object.keys(r.errors).length > 0)))
    : data;
    
  const getOriginalIndex = (filteredIndex: number) => {
      if (!isFiltered || !validationResult) return filteredIndex;
      const rowData = displayedData[filteredIndex];
      return data.indexOf(rowData);
  }

  const issueRowsCount = validationResult?.rows.filter(r => r.action === "IGNORE" || r.action === "DUPLICATE" || Object.keys(r.errors).length > 0).length || 0;
  
  const duplicateRows = validationResult?.rows.filter(r => r.action === 'DUPLICATE') || [];

  return (
    <TooltipProvider>
        <div className="flex flex-col h-full overflow-hidden">
            <ScrollArea className="flex-grow rounded-md border relative">
                <Table>
                    <TableHeader className="sticky top-0 bg-muted z-10">
                        <TableRow>
                            <TableHead className="whitespace-nowrap">Row</TableHead>
                            {headers.map(header => <TableHead key={header} className="whitespace-nowrap">{header}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayedData.map((row, index) => {
                            const originalRowIndex = getOriginalIndex(index);
                            const cellAction = getCellAction(originalRowIndex);
                            const tooltipText = getCellTooltip(originalRowIndex);

                            let rowClassName = "";
                             if (cellAction === "DUPLICATE") rowClassName = "bg-orange-500/20";
                             else if (cellAction === "IGNORE") rowClassName = "bg-red-500/20";
                             else if (cellAction?.includes("FIX")) rowClassName = "bg-yellow-500/20";
                             else if (cellAction === "UPDATE") rowClassName = "bg-blue-500/10";
                             else if (cellAction === "CREATE") rowClassName = "bg-green-500/10";

                            return (
                                <TableRow key={originalRowIndex} className={rowClassName}>
                                     <TableCell className="text-sm whitespace-nowrap px-4 py-2 font-medium text-muted-foreground">{originalRowIndex + 1}</TableCell>
                                    {headers.map(header => {
                                        const cellContent = <div className="max-w-[200px] truncate">{String(row[header] ?? '')}</div>;
                                        return (
                                            <TableCell key={`${originalRowIndex}-${header}`} className="p-0">
                                                 {tooltipText ? (
                                                    <Tooltip delayDuration={100}>
                                                        <TooltipTrigger asChild>
                                                            <div className="px-4 py-2 w-full h-full cursor-help">{cellContent}</div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>{tooltipText}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                ) : (
                                                    <div className="px-4 py-2">{cellContent}</div>
                                                )}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
            <DialogFooter className="pt-4 flex-shrink-0 items-center flex-wrap gap-2">
                 <div className="text-sm text-muted-foreground mr-auto flex items-center">
                    {validationResult !== null ? (
                         isFiltered && issueRowsCount > 0 ? (
                             <>
                                <span>Showing {issueRowsCount} of {data.length} rows with issues.</span>
                                <Button variant="link" size="sm" onClick={() => setIsFiltered(false)} className="p-1 h-auto">Show all</Button>
                             </>
                         ) : `Showing all ${data.length} records.`
                    ) : `Showing all ${data.length} records.`}
                </div>
                <div className="flex gap-2">
                    {validationResult && issueRowsCount > 0 && (
                        <Button variant="secondary" onClick={handleDownloadInvalid}>
                            <Download className="mr-2 h-4 w-4" />
                            Download Invalid Rows ({issueRowsCount})
                        </Button>
                    )}
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleValidate} disabled={isValidating}>
                        {isValidating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validating...</> : 'Validate Data'}
                    </Button>
                    {validationResult && validationResult.summary.duplicates > 0 ? (
                        <div className="flex gap-2">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive"><DatabaseBackup className="mr-2 h-4 w-4" /> Overwrite ({validationResult.summary.duplicates})</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Confirm Overwrite</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will overwrite {validationResult.summary.duplicates} existing records with the data from your CSV file. This action cannot be undone. Are you sure you want to proceed?
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleImport('overwrite')}>Yes, Overwrite</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <Button onClick={() => handleImport('skip')} variant="outline">
                                <SkipForward className="mr-2 h-4 w-4" />
                                Skip Duplicates & Import Rest
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={() => handleImport(null)} disabled={!validationResult || isImporting}>
                            {isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : 'Import Data'}
                        </Button>
                    )}
                </div>
            </DialogFooter>
             <Dialog open={isInspectDialogOpen} onOpenChange={setIsInspectDialogOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Duplicate Records Found</DialogTitle>
                        <DialogDescription>
                            The following rows from your CSV were identified as duplicates. They will be skipped unless you choose to overwrite.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="h-96">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Row #</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>PAN</TableHead>
                                    <TableHead>Reason</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {duplicateRows.map(r => (
                                    <TableRow key={r.originalIndex}>
                                        <TableCell>{r.originalIndex + 1}</TableCell>
                                        <TableCell>{r.row.Name}</TableCell>
                                        <TableCell>{r.row.PAN}</TableCell>
                                        <TableCell className="text-destructive">{r.duplicateReason}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    </TooltipProvider>
  );
}
