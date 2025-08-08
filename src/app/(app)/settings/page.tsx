
'use client';

import * as React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { collection, writeBatch, getDocs, query, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Download, Loader2, Upload, DatabaseZap, ShieldCheck, Edit, Trash2 } from 'lucide-react';
import type { Client, Engagement, Employee } from '@/lib/data';
import { Input } from '@/components/ui/input';
import Papa from "papaparse";
import Link from 'next/link';

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loadingDeleteTransactional, setLoadingDeleteTransactional] = React.useState(false);
  const [loadingDeleteMaster, setLoadingDeleteMaster] = React.useState(false);
  const [loadingBackup, setLoadingBackup] = React.useState(false);
  const [loadingRestore, setLoadingRestore] = React.useState(false);
  const [loadingExport, setLoadingExport] = React.useState<string | null>(null);
  const [backupFile, setBackupFile] = React.useState<File | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = React.useState(false);
  const [loadingMasterBackup, setLoadingMasterBackup] = React.useState(false);

  const isAdmin = user?.email === 'ca.tonnyvarghese@gmail.com';

  const handleExportToCSV = async (collectionName: 'clients' | 'engagements' | 'employees', fileName: string) => {
    setLoadingExport(collectionName);
    try {
        const q = query(collection(db, collectionName));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (data.length === 0) {
            toast({ title: "No Data", description: `There is no data in the ${collectionName} collection to export.`, variant: "destructive" });
            return;
        }

        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({
            title: 'Export Successful',
            description: `${data.length} records from ${collectionName} have been exported.`,
        });

    } catch (error) {
        console.error(`Error exporting ${collectionName}:`, error);
        toast({
            title: 'Export Failed',
            description: `Could not export ${collectionName} data.`,
            variant: 'destructive',
        });
    } finally {
        setLoadingExport(null);
    }
  };

  const handleBackup = async (type: 'transactional' | 'master') => {
    if (type === 'transactional') setLoadingBackup(true);
    if (type === 'master') setLoadingMasterBackup(true);

    const collectionsToBackup = type === 'transactional'
        ? ['clients', 'engagements', 'tasks', 'pendingInvoices', 'communications', 'chatMessages', 'leaveRequests', 'events', 'timesheets', 'activityLog']
        : ['employees', 'departments', 'engagementTypes', 'clientCategories', 'countries', 'permissions', 'firms', 'taxRates', 'hsnSacCodes', 'salesItems'];
    
    const fileName = `dmv_central_backup_${type}_${new Date().toISOString().split('T')[0]}.json`;

    try {
      const backupData: { [key: string]: any[] } = {
        backupType: type,
        backupDate: new Date().toISOString(),
      };

      for (const collectionName of collectionsToBackup) {
          const snapshot = await getDocs(query(collection(db, collectionName)));
          backupData[collectionName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: `Backup of ${type} data has been downloaded.`,
      });

    } catch (error) {
       console.error(`Error backing up ${type} data:`, error);
       toast({
        title: 'Error',
        description: `Failed to create ${type} backup. Check the console for details.`,
        variant: 'destructive',
      });
    } finally {
        if (type === 'transactional') setLoadingBackup(false);
        if (type === 'master') setLoadingMasterBackup(false);
    }
  };

  const handleRestoreFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/json') {
      setBackupFile(file);
    } else {
      toast({ title: 'Invalid File', description: 'Please select a valid JSON backup file.', variant: 'destructive' });
      setBackupFile(null);
    }
  };

  const handleRestoreData = async () => {
    if (!backupFile) {
        toast({ title: 'No File', description: 'Please select a backup file to restore.', variant: 'destructive'});
        return;
    }

    setLoadingRestore(true);
    try {
        const fileContent = await backupFile.text();
        const backupData = JSON.parse(fileContent);

        if (!backupData.backupType || !backupData.backupDate) {
            throw new Error("Invalid backup file: missing backupType or backupDate.");
        }

        const collectionsToRestore = backupData.backupType === 'transactional'
            ? ['clients', 'engagements', 'tasks', 'pendingInvoices', 'communications', 'chatMessages', 'leaveRequests', 'events', 'timesheets', 'activityLog']
            : ['employees', 'departments', 'engagementTypes', 'clientCategories', 'countries', 'permissions', 'firms', 'taxRates', 'hsnSacCodes', 'salesItems'];
        
        const batch = writeBatch(db);

        // Delete existing data from collections being restored
        for (const collectionName of collectionsToRestore) {
            if (backupData[collectionName]) { // Only delete if data for it exists in backup
                 const existingDocs = await getDocs(query(collection(db, collectionName)));
                 existingDocs.forEach(doc => batch.delete(doc.ref));
            }
        }
        
        // Add new data from backup
        let totalRestoredCount = 0;
        for (const collectionName of collectionsToRestore) {
            if (Array.isArray(backupData[collectionName])) {
                backupData[collectionName].forEach((item: any) => {
                    const docRef = item.id ? doc(db, collectionName, item.id) : doc(collection(db, collectionName));
                    batch.set(docRef, item);
                });
                totalRestoredCount += backupData[collectionName].length;
            }
        }

        await batch.commit();

        toast({
            title: 'Restore Successful',
            description: `Restored ${totalRestoredCount} records for ${backupData.backupType} data.`,
        });

    } catch (error) {
        console.error('Error restoring data:', error);
        toast({ title: 'Restore Failed', description: 'Failed to restore data. Check the console for details.', variant: 'destructive'});
    } finally {
        setLoadingRestore(false);
        setIsRestoreConfirmOpen(false);
        setBackupFile(null);
    }
  }

  const handleDeleteTransactionalData = async () => {
    setLoadingDeleteTransactional(true);
    try {
      const batch = writeBatch(db);
      
      const collectionsToDelete = ['clients', 'engagements', 'tasks', 'pendingInvoices', 'communications', 'chatMessages', 'leaveRequests', 'events', 'timesheets', 'activityLog', 'recurringEngagements', 'todos'];
      
      for (const collectionName of collectionsToDelete) {
          const snapshot = await getDocs(query(collection(db, collectionName)));
          snapshot.forEach((doc) => batch.delete(doc.ref));
      }

      await batch.commit();

      toast({
        title: 'Success',
        description: 'All transactional data has been deleted.',
      });
    } catch (error) {
      console.error('Error deleting transactional data:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete transactional data. Check the console for details.',
        variant: 'destructive',
      });
    } finally {
      setLoadingDeleteTransactional(false);
    }
  };

  const handleDeleteMasterData = async () => {
    setLoadingDeleteMaster(true);
    try {
        const batch = writeBatch(db);
        
        const otherMasterCollections = ['employees', 'departments', 'engagementTypes', 'clientCategories', 'countries', 'permissions', 'firms', 'taxRates', 'hsnSacCodes', 'salesItems'];
        for (const collectionName of otherMasterCollections) {
            const snapshot = await getDocs(query(collection(db, collectionName)));
            snapshot.forEach((doc) => batch.delete(doc.ref));
        }

        await batch.commit();
        toast({
            title: 'Success',
            description: 'All master data has been deleted.',
        });

    } catch (error) {
         console.error('Error deleting master data:', error);
        toast({
            title: 'Error',
            description: 'Failed to delete master data. Check the console for details.',
            variant: 'destructive',
        });
    } finally {
        setLoadingDeleteMaster(false);
    }
  };

  if (authLoading) {
    return <div className="flex h-full w-full items-center justify-center">Loading settings...</div>;
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>You do not have permission to view this page.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between space-y-2 mb-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Settings</h2>
          <p className="text-muted-foreground">Manage your application settings and access controls.</p>
        </div>
      </div>
      <div className="space-y-6">
        <Card>
            <CardHeader className='flex flex-row items-center justify-between'>
            <div>
                <CardTitle className='flex items-center gap-2'><ShieldCheck /> Access Control</CardTitle>
                <CardDescription>
                    Define which user roles can access specific application features.
                </CardDescription>
            </div>
            <Button asChild>
                <Link href="/settings/access-control">
                    <Edit className='mr-2' /> Edit Permissions
                </Link>
            </Button>
            </CardHeader>
        </Card>
        <Card>
            <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>
                Use these options to manage the data in your application.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-border p-4 flex flex-col gap-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Export Data to CSV</h3>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Export all client data.</p>
                            <Button variant="outline" onClick={() => handleExportToCSV('clients', 'clients_export')} disabled={!!loadingExport}>
                                {loadingExport === 'clients' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Export Clients
                            </Button>
                        </div>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Export all engagement data.</p>
                            <Button variant="outline" onClick={() => handleExportToCSV('engagements', 'engagements_export')} disabled={!!loadingExport}>
                                {loadingExport === 'engagements' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Export Engagements
                            </Button>
                        </div>
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">Export all employee data.</p>
                            <Button variant="outline" onClick={() => handleExportToCSV('employees', 'employees_export')} disabled={!!loadingExport}>
                                {loadingExport === 'employees' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Export Employees
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-lg border border-border p-4 flex flex-col gap-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Backup & Restore</h3>
                         <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">Backup All Data</h3>
                                <p className="text-sm text-muted-foreground">
                                    Download JSON files of your data.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Button variant="outline" onClick={() => handleBackup('transactional')} disabled={loadingBackup}>
                                    {loadingBackup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Backup Transactional
                                </Button>
                                <Button variant="outline" onClick={() => handleBackup('master')} disabled={loadingMasterBackup}>
                                    {loadingMasterBackup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Backup Master
                                </Button>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">Restore Data</h3>
                                <p className="text-sm text-muted-foreground">
                                    Overwrite existing data from a JSON backup file.
                                </p>
                                {backupFile && <p className="text-sm text-primary mt-2">Selected: {backupFile.name}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button asChild variant="outline">
                                    <label htmlFor="restore-file-input">
                                        <Upload className="mr-2 h-4 w-4" />
                                        Select
                                        <Input id="restore-file-input" type="file" accept="application/json" className="hidden" onChange={handleRestoreFileSelect} />
                                    </label>
                                </Button>
                                <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
                                    <AlertDialogTrigger asChild>
                                        <Button disabled={!backupFile || loadingRestore}>
                                            {loadingRestore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                            Restore
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                            This will first delete all existing data for the backup type (master or transactional), then restore from the selected file. This cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleRestoreData}>Yes, Restore</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </CardContent>
        </Card>

        <Card className="border-destructive">
             <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive"><DatabaseZap /> Danger Zone</CardTitle>
                <CardDescription>
                    These are destructive actions that permanently delete data. Use them with extreme caution.
                </CardDescription>
            </CardHeader>
             <CardContent className="space-y-4">
                 <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                    <div>
                        <h3 className="font-semibold">Delete Transactional Data</h3>
                        <p className="text-sm text-muted-foreground">
                        Permanently delete all **clients, engagements, tasks, timesheets, and communications**. Master data will not be affected.
                        </p>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={loadingDeleteTransactional}>
                            {loadingDeleteTransactional ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete Transactional Data
                        </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete all transactional data. Master data will NOT be deleted.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteTransactionalData} className="bg-destructive hover:bg-destructive/90">Continue</AlertDialogAction>
                        </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
                 <div className="flex items-center justify-between rounded-lg border border-destructive/50 p-4">
                    <div>
                        <h3 className="font-semibold">Delete Master Data</h3>
                        <p className="text-sm text-muted-foreground">
                        Permanently delete all **employees, departments, permissions, and engagement types**. This will reset the app's core configuration.
                        </p>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={loadingDeleteMaster}>
                            {loadingDeleteMaster ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete Master Data
                        </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete all master data (employees, departments, etc.). The app may not function correctly for other users until you re-seed the database.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteMasterData} className="bg-destructive hover:bg-destructive/90">Continue</AlertDialogAction>
                        </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
      </div>
    </>
  );
}
