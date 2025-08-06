
"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { Button } from "../ui/button";
import { DialogFooter, DialogClose } from "../ui/dialog";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "@/lib/utils";
import { MANDATORY_CLIENT_HEADERS } from "./bulk-update-data";
import { Loader2 } from "lucide-react";
import { writeBatch, collection, doc, getDocs, query, where } from "firebase/firestore";
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
import type { Client } from "@/lib/data";

interface ValidationTableProps {
  data: any[];
  onComplete: () => void;
}

type RowAction = "CREATE" | "UPDATE" | "IGNORE" | "FIX_AND_CREATE" | "FIX_AND_UPDATE";

interface ValidationResult {
    rows: {
        row: any;
        action: RowAction;
        errors: { [key: string]: string };
        originalIndex: number;
        existingClientId?: string;
    }[];
    summary: {
        creates: number;
        updates: number;
        ignores: number;
    }
}


export function ValidationTable({ data, onComplete }: ValidationTableProps) {
  const [validationResult, setValidationResult] = React.useState<ValidationResult | null>(null);
  const [isFiltered, setIsFiltered] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
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
        const clientsQuery = query(collection(db, "clients"));
        const clientsSnapshot = await getDocs(clientsQuery);
        const existingClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        const panToIdMap = new Map(existingClients.map(c => [c.pan, c.id]));

        const result: ValidationResult = {
            rows: [],
            summary: { creates: 0, updates: 0, ignores: 0 }
        };

        data.forEach((row, rowIndex) => {
            const rowErrors: { [key: string]: string } = {};
            let action: RowAction = "CREATE";
            let existingClientId: string | undefined = undefined;
            let isUpdate = false;

            if (row['PAN'] && String(row['PAN']).trim() !== '' && row['PAN'] !== 'PANNOTAVLBL') {
                if (panToIdMap.has(row['PAN'])) {
                    action = "UPDATE";
                    isUpdate = true;
                    existingClientId = panToIdMap.get(row['PAN']);
                }
            }
            
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
                    rowErrors['Mail ID'] = 'Invalid email format. It will be set to "mail@notavailable.com".';
                }

                if (!row['PAN'] && !isUpdate) { // Only error on missing PAN for new clients
                    rowErrors['PAN'] = 'PAN is missing. It will be set to "PANNOTAVLBL" for now. Please update it later.';
                }
            }

            if (action !== "IGNORE" && Object.keys(rowErrors).length > 0) {
                action = isUpdate ? "FIX_AND_UPDATE" : "FIX_AND_CREATE";
            }
            
            result.rows.push({ row, action, errors: rowErrors, originalIndex: rowIndex, existingClientId });
        });

        result.summary.creates = result.rows.filter(r => r.action === "CREATE" || r.action === "FIX_AND_CREATE").length;
        result.summary.updates = result.rows.filter(r => r.action === "UPDATE" || r.action === "FIX_AND_UPDATE").length;
        result.summary.ignores = result.rows.filter(r => r.action === "IGNORE").length;

        setValidationResult(result);

        if (result.rows.some(r => r.action === "IGNORE" || Object.keys(r.errors).length > 0)) {
            setIsFiltered(true);
        }

        toast({
            title: "Validation Complete",
            description: `${result.summary.creates} new, ${result.summary.updates} updates, and ${result.summary.ignores} ignored records found.`,
            variant: result.summary.ignores > 0 ? "destructive" : "default",
        })

    } catch (error) {
        console.error("Error during validation:", error);
        toast({ title: "Validation Failed", description: "Could not fetch existing client data for validation.", variant: "destructive"});
    } finally {
        setIsValidating(false);
    }
  };
  
  const handleImport = async (): Promise<void> => {
    if (!validationResult) {
        toast({ title: "Validation required", description: "Please validate the data before importing.", variant: "destructive"});
        return;
    }

    const rowsToImport = validationResult.rows.filter(r => r.action !== "IGNORE");

    if (rowsToImport.length === 0) {
        toast({ title: "No data to import", description: "There are no valid records to import.", variant: "destructive"});
        return;
    }

    setIsImporting(true);
    try {
        const batch = writeBatch(db);
        
        rowsToImport.forEach(({ row, action, existingClientId }) => {
            const isUpdate = action === "UPDATE" || action === "FIX_AND_UPDATE";
            const clientRef = isUpdate && existingClientId ? doc(db, 'clients', existingClientId) : doc(collection(db, 'clients'));

            const clientData: Partial<Client> = {
                ...row,
                name: row.Name, // Ensure name is always present
                mailId: (!row['Mail ID'] || !emailRegex.test(row['Mail ID'])) ? 'mail@notavailable.com' : row['Mail ID'],
                mobileNumber: !row['Mobile Number'] ? '1111111111' : row['Mobile Number'],
                pan: !row['PAN'] && !isUpdate ? 'PANNOTAVLBL' : row['PAN'],
                category: !row['Category'] ? 'unassigned' : row['Category'],
                partnerId: !row['Partner'] ? 'unassigned' : row['Partner'],
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
            description: (
                <div>
                    <div>Total rows in file: {data.length}</div>
                    <div>Records Created: {validationResult.summary.creates}</div>
                    <div>Records Updated: {validationResult.summary.updates}</div>
                    <div>Records Ignored: {validationResult.summary.ignores}</div>
                </div>
            ),
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

  const getErrorForCell = (rowIndex: number, header: string): string | null => {
      const resultRow = validationResult?.rows.find(r => r.originalIndex === rowIndex);
      return resultRow ? resultRow.errors[header] || null : null;
  }
  
  const getActionForCell = (rowIndex: number, header: string): RowAction | null => {
    if (header !== "Name") return null;
    const resultRow = validationResult?.rows.find(r => r.originalIndex === rowIndex);
    return resultRow ? resultRow.action : null;
  }

  const displayedData = isFiltered && validationResult
    ? data.filter((_, rowIndex) => validationResult.rows.some(r => r.originalIndex === rowIndex && (r.action === "IGNORE" || Object.keys(r.errors).length > 0)))
    : data;
    
  const getOriginalIndex = (filteredIndex: number) => {
      if (!isFiltered || !validationResult) return filteredIndex;
      const rowData = displayedData[filteredIndex];
      return data.indexOf(rowData);
  }

  const hasIssues = validationResult && validationResult.rows.some(r => r.action !== "CREATE" && r.action !== "UPDATE");
  const totalErrorRows = validationResult?.rows.filter(r => r.action === "IGNORE" || Object.keys(r.errors).length > 0).length || 0;


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
                            return (
                                <TableRow key={originalRowIndex}>
                                     <TableCell className="text-sm whitespace-nowrap px-4 py-2 font-medium text-muted-foreground">{originalRowIndex + 1}</TableCell>
                                    {headers.map(header => {
                                        const cellError = getErrorForCell(originalRowIndex, header);
                                        const cellAction = getActionForCell(originalRowIndex, header);

                                        const cellContent = <div className="max-w-[200px] truncate">{String(row[header] ?? '')}</div>;
                                        
                                        let cellClassName = "text-sm whitespace-nowrap p-0";
                                        if (cellError) {
                                            if (cellAction === "IGNORE") {
                                                cellClassName = cn(cellClassName, "bg-red-500/20");
                                            } else {
                                                cellClassName = cn(cellClassName, "bg-yellow-500/20");
                                            }
                                        } else {
                                           if (cellAction === "UPDATE" || cellAction === "FIX_AND_UPDATE") {
                                               cellClassName = cn(cellClassName, "bg-blue-500/10");
                                           } else if (cellAction === "CREATE" || cellAction === "FIX_AND_CREATE") {
                                               cellClassName = cn(cellClassName, "bg-green-500/10");
                                           }
                                        }


                                        const actionText = cellAction ? {
                                            "CREATE": "Will be created",
                                            "UPDATE": "Will be updated",
                                            "IGNORE": "Will be ignored (Fatal Error)",
                                            "FIX_AND_CREATE": "Will be created with fixes (Warning)",
                                            "FIX_AND_UPDATE": "Will be updated with fixes (Warning)",
                                        }[cellAction] : null;


                                        const tooltipText = cellError || actionText;

                                        return (
                                            <TableCell key={`${originalRowIndex}-${header}`} className={cellClassName}>
                                                 {tooltipText ? (
                                                    <Tooltip delayDuration={100}>
                                                        <TooltipTrigger asChild>
                                                            <div className="px-4 py-2 w-full h-full cursor-help">{cellContent}</div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className={cn(cellAction === "IGNORE" && "text-destructive font-bold")}>{tooltipText}</p>
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
            <DialogFooter className="pt-4 flex-shrink-0">
                <div className="text-sm text-muted-foreground mr-auto flex items-center">
                    {validationResult !== null ? (
                         isFiltered && totalErrorRows > 0 ? (
                             <>
                                <span>Showing {totalErrorRows} of {data.length} rows with issues.</span>
                                <Button variant="link" size="sm" onClick={() => setIsFiltered(false)} className="p-1 h-auto">Show all</Button>
                             </>
                         ) : `Showing all ${data.length} records.`
                    ) : `Showing all ${data.length} records.`}
                </div>
                <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleValidate} disabled={isValidating}>
                    {isValidating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Validating...</> : 'Validate Data'}
                </Button>
                <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                    <AlertDialogTrigger asChild>
                        <Button 
                            disabled={!validationResult || isImporting}
                            onClick={() => { if (hasIssues) setIsConfirmOpen(true); else handleImport(); }}
                        >
                            {isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : 'Import Data'}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                         <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Import</AlertDialogTitle>
                            <div className="text-sm text-muted-foreground py-4">
                                <div>Your data has been reviewed:</div>
                                <ul className="list-disc pl-5 mt-2 space-y-1">
                                    <li><b>{validationResult?.summary.creates || 0}</b> new records will be created.</li>
                                    <li><b>{validationResult?.summary.updates || 0}</b> existing records will be updated.</li>
                                    <li><b>{validationResult?.summary.ignores || 0}</b> records will be ignored due to missing data.</li>
                                </ul>
                                <div className="mt-4">Do you want to proceed with the import?</div>
                            </div>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>No, Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleImport}>Yes, Import Now</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogFooter>
        </div>
    </TooltipProvider>
  );
}
