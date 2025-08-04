
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
import { Download, Loader2, Upload, DatabaseZap, ShieldCheck, Edit } from 'lucide-react';
import type { Client, Engagement, Employee } from '@/lib/data';
import { Input } from '@/components/ui/input';
import Papa from "papaparse";
import Link from 'next/link';

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loadingDelete, setLoadingDelete] = React.useState(false);
  const [loadingBackup, setLoadingBackup] = React.useState(false);
  const [loadingRestore, setLoadingRestore] = React.useState(false);
  const [loadingExport, setLoadingExport] = React.useState<string | null>(null);
  const [backupFile, setBackupFile] = React.useState<File | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = React.useState(false);

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

  const handleBackupTransactionalData = async () => {
    setLoadingBackup(true);
    try {
      const clientsQuery = query(collection(db, 'clients'));
      const engagementsQuery = query(collection(db, 'engagements'));

      const [clientsSnapshot, engagementsSnapshot] = await Promise.all([
        getDocs(clientsQuery),
        getDocs(engagementsQuery)
      ]);

      const backupData = {
        clients: clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        engagements: engagementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        backupDate: new Date().toISOString(),
      };

      // Create a minified JSON for smaller file size
      const jsonString = JSON.stringify(backupData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dmv_central_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Backup has been downloaded successfully.',
      });

    } catch (error) {
       console.error('Error backing up transactional data:', error);
       toast({
        title: 'Error',
        description: 'Failed to create backup. Check the console for details.',
        variant: 'destructive',
      });
    } finally {
        setLoadingBackup(false);
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

        // Basic validation of the backup file structure
        if (!backupData.clients || !backupData.engagements || !Array.isArray(backupData.clients) || !Array.isArray(backupData.engagements)) {
            throw new Error("Invalid backup file structure.");
        }

        const batch = writeBatch(db);

        // Clear existing transactional data
        const existingClients = await getDocs(query(collection(db, 'clients')));
        existingClients.forEach(doc => batch.delete(doc.ref));
        const existingEngagements = await getDocs(query(collection(db, 'engagements')));
        existingEngagements.forEach(doc => batch.delete(doc.ref));

        // Set new data from backup
        backupData.clients.forEach((client: Client) => {
            const docRef = doc(db, 'clients', client.id);
            batch.set(docRef, client);
        });
        backupData.engagements.forEach((engagement: Engagement) => {
            const docRef = doc(db, 'engagements', engagement.id);
            batch.set(docRef, engagement);
        });

        await batch.commit();

        toast({
            title: 'Restore Successful',
            description: `Restored ${backupData.clients.length} clients and ${backupData.engagements.length} engagements.`,
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
    setLoadingDelete(true);
    try {
      const batch = writeBatch(db);
      
      const collectionsToDelete = ['clients', 'engagements', 'tasks', 'pendingInvoices'];
      
      for (const collectionName of collectionsToDelete) {
          const snapshot = await getDocs(query(collection(db, collectionName)));
          snapshot.forEach((doc) => batch.delete(doc.ref));
      }

      await batch.commit();

      toast({
        title: 'Success',
        description: 'All clients, engagements, tasks, and pending invoices have been deleted.',
      });
    } catch (error) {
      console.error('Error deleting transactional data:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete transactional data. Check the console for details.',
        variant: 'destructive',
      });
    } finally {
      setLoadingDelete(false);
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
                Use these options to manage the data in your application. These actions are irreversible and should be used with caution.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Export Buttons */}
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

                    {/* Backup and Restore */}
                    <div className="rounded-lg border border-border p-4 flex flex-col gap-4">
                        <h3 className="font-semibold text-lg border-b pb-2">Backup & Restore</h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">Backup Transactional Data</h3>
                                <p className="text-sm text-muted-foreground">
                                    Download a JSON file of clients and engagements.
                                </p>
                            </div>
                            <Button variant="outline" onClick={handleBackupTransactionalData} disabled={loadingBackup}>
                                {loadingBackup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                Backup
                            </Button>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold">Restore Transactional Data</h3>
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
                                            This will first delete all existing clients and engagements, then restore from the backup. This cannot be undone.
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
                
                <div className="flex items-center justify-between rounded-lg border border-destructive p-4 mt-4">
                <div>
                    <h3 className="font-semibold">Delete Transactional Data</h3>
                    <p className="text-sm text-muted-foreground">
                    This will permanently delete all **clients, engagements, tasks, and pending invoices**. Master data will not be affected.
                    </p>
                </div>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={loadingDelete}>
                        {loadingDelete ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Delete Data
                    </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete all transactional data (clients, engagements, tasks, and pending invoices). Master data will NOT be deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTransactionalData}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                </div>
            </div>
            </CardContent>
        </Card>
      </div>
    </>
  );
}
