
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
import { Download, Loader2, Upload, DatabaseZap, ShieldCheck, Edit, Trash2, Database, ExternalLink } from 'lucide-react';
import type { Client, Engagement, Employee } from '@/lib/data';
import { Input } from '@/components/ui/input';
import Papa from "papaparse";
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loadingDeleteTransactional, setLoadingDeleteTransactional] = React.useState(false);
  const [loadingDeleteMaster, setLoadingDeleteMaster] = React.useState(false);
  const [loadingBackup, setLoadingBackup] = React.useState<string | null>(null);
  const [loadingRestore, setLoadingRestore] = React.useState(false);
  const [backupFile, setBackupFile] = React.useState<File | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = React.useState(false);
  const [backupFileInfo, setBackupFileInfo] = React.useState<{type: 'master' | 'transactional' | 'full' | 'unknown', date?: string} | null>(null);
  const [deleteTransactionalConfirmText, setDeleteTransactionalConfirmText] = React.useState('');

  const isAdmin = user?.email === 'ca.tonnyvarghese@gmail.com';
  
  const handleBackup = async (type: 'transactional' | 'master' | 'full') => {
    setLoadingBackup(type);
    
    const masterCollections = ['employees', 'departments', 'engagementTypes', 'clientCategories', 'countries', 'permissions', 'firms', 'taxRates', 'hsnSacCodes', 'salesItems'];
    const transactionalCollections = ['clients', 'engagements', 'tasks', 'pendingInvoices', 'communications', 'chatMessages', 'leaveRequests', 'events', 'timesheets', 'activityLog', 'recurringEngagements', 'todos'];
    
    let collectionsToBackup: string[] = [];
    if (type === 'transactional') collectionsToBackup = transactionalCollections;
    else if (type === 'master') collectionsToBackup = masterCollections;
    else if (type === 'full') collectionsToBackup = [...masterCollections, ...transactionalCollections];
    
    const fileName = `dmv_central_backup_${type}_${new Date().toISOString().split('T')[0]}.json`;

    try {
      const backupData: { [key: string]: any[] } = {};
      
      backupData._metadata = [{
          backupType: type,
          backupDate: new Date().toISOString(),
          version: '1.0'
      }];

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
        setLoadingBackup(null);
    }
  };

  const handleRestoreFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/json') {
      setBackupFile(file);
       try {
            const fileContent = await file.text();
            const backupData = JSON.parse(fileContent);
            if (backupData._metadata && backupData._metadata[0]) {
                const { backupType, backupDate } = backupData._metadata[0];
                setBackupFileInfo({ type: backupType, date: backupDate });
            } else {
                setBackupFileInfo({ type: 'unknown' });
            }
        } catch (e) {
            setBackupFileInfo({ type: 'unknown' });
        }

    } else {
      toast({ title: 'Invalid File', description: 'Please select a valid JSON backup file.', variant: 'destructive' });
      setBackupFile(null);
      setBackupFileInfo(null);
    }
  };

  const handleRestoreData = async () => {
    if (!backupFile || !backupFileInfo?.type || backupFileInfo.type === 'unknown') {
        toast({ title: 'No File or Invalid Type', description: 'Please select a valid backup file to restore.', variant: 'destructive'});
        return;
    }

    setLoadingRestore(true);
    try {
        const fileContent = await backupFile.text();
        const backupData = JSON.parse(fileContent);

        const masterCollections = ['employees', 'departments', 'engagementTypes', 'clientCategories', 'countries', 'permissions', 'firms', 'taxRates', 'hsnSacCodes', 'salesItems'];
        const transactionalCollections = ['clients', 'engagements', 'tasks', 'pendingInvoices', 'communications', 'chatMessages', 'leaveRequests', 'events', 'timesheets', 'activityLog', 'recurringEngagements', 'todos'];

        let collectionsToRestore: string[] = [];
        if (backupFileInfo.type === 'transactional') collectionsToRestore = transactionalCollections;
        else if (backupFileInfo.type === 'master') collectionsToRestore = masterCollections;
        else if (backupFileInfo.type === 'full') collectionsToRestore = [...masterCollections, ...transactionalCollections];
        
        const batch = writeBatch(db);

        for (const collectionName of collectionsToRestore) {
            if (backupData[collectionName]) {
                 const existingDocs = await getDocs(query(collection(db, collectionName)));
                 existingDocs.forEach(doc => batch.delete(doc.ref));
            }
        }
        
        let totalRestoredCount = 0;
        for (const collectionName of collectionsToRestore) {
            if (Array.isArray(backupData[collectionName])) {
                for(const item of backupData[collectionName]) {
                    const docRef = item.id ? doc(db, collectionName, item.id) : doc(collection(db, collectionName));
                     // Ensure the 'id' field is consistent with the document ID
                    const dataToSet = { ...item, id: docRef.id };
                    batch.set(docRef, dataToSet);
                }
                totalRestoredCount += backupData[collectionName].length;
            }
        }

        await batch.commit();

        toast({
            title: 'Restore Successful',
            description: `Restored ${totalRestoredCount} records for ${backupFileInfo.type} data.`,
        });

    } catch (error) {
        console.error('Error restoring data:', error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ title: 'Restore Failed', description: `Failed to restore data: ${errorMessage}`, variant: 'destructive'});
    } finally {
        setLoadingRestore(false);
        setIsRestoreConfirmOpen(false);
        setBackupFile(null);
        setBackupFileInfo(null);
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
      setDeleteTransactionalConfirmText('');
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

        <Dialog>
            <DialogTrigger asChild>
                 <Card className='cursor-pointer hover:border-primary/80 hover:shadow-primary/20 transition-all group'>
                    <CardHeader>
                    <div className="flex justify-between items-start">
                         <div>
                            <CardTitle className='flex items-center gap-2'><Database /> Data Management</CardTitle>
                            <CardDescription>
                                Export, backup, and restore your firm's data.
                            </CardDescription>
                         </div>
                         <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </div>
                    </CardHeader>
                </Card>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Data Management</DialogTitle>
                    <DialogDescription>
                        Use these options to manage the data in your application.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                     <div className="rounded-lg border p-4 space-y-4">
                        <h3 className="font-semibold">Backup Data</h3>
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-muted-foreground">Master Data (Employees, Types, etc.)</p>
                            <Button variant="outline" onClick={() => handleBackup('master')} disabled={!!loadingBackup}>
                                {loadingBackup === 'master' ? <Loader2 className="mr-2 animate-spin" /> : <Download className="mr-2" />}
                                Backup Master
                            </Button>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-muted-foreground">Transactional Data (Clients, Engagements)</p>
                            <Button variant="outline" onClick={() => handleBackup('transactional')} disabled={!!loadingBackup}>
                                {loadingBackup === 'transactional' ? <Loader2 className="mr-2 animate-spin" /> : <Download className="mr-2" />}
                                Backup Transactional
                            </Button>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-muted-foreground">Complete backup of all data.</p>
                             <Button variant="outline" onClick={() => handleBackup('full')} disabled={!!loadingBackup}>
                                {loadingBackup === 'full' ? <Loader2 className="mr-2 animate-spin" /> : <Download className="mr-2" />}
                                Backup All Data
                            </Button>
                        </div>
                    </div>
                     <div className="rounded-lg border p-4 space-y-4">
                        <h3 className="font-semibold">Restore Data</h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Overwrite existing data from a JSON backup file.
                                </p>
                                {backupFile && (
                                <p className="text-sm text-primary mt-2">
                                    Selected: {backupFile.name} ({backupFileInfo?.type || '...'})
                                </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button asChild variant="outline">
                                    <label htmlFor="restore-file-input">
                                        <Upload className="mr-2 h-4 w-4" />
                                        Select File
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
                                            You are about to restore a <span className="font-bold text-primary">{backupFileInfo?.type}</span> backup. This will first delete all existing <span className="font-bold text-destructive">{backupFileInfo?.type}</span> data and then replace it with data from the backup file. This action cannot be undone.
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
            </DialogContent>
        </Dialog>

        <Dialog>
            <DialogTrigger asChild>
                 <Card className='cursor-pointer hover:border-destructive/80 hover:shadow-destructive/20 transition-all group border-destructive/50'>
                    <CardHeader>
                    <div className="flex justify-between items-start">
                         <div>
                            <CardTitle className='flex items-center gap-2 text-destructive'><DatabaseZap /> Danger Zone</CardTitle>
                            <CardDescription>
                                These are destructive actions that permanently delete data.
                            </CardDescription>
                         </div>
                         <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </div>
                    </CardHeader>
                </Card>
            </DialogTrigger>
            <DialogContent>
                 <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'><DatabaseZap /> Danger Zone</DialogTitle>
                    <DialogDescription>
                        These are destructive actions that permanently delete data. Use them with extreme caution.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
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
                                Delete
                            </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. To confirm, please type{" "}
                                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold text-destructive">
                                    delete transactional data
                                </code>{" "}
                                below.
                                </AlertDialogDescription>
                                <Input
                                    id="delete-confirm"
                                    value={deleteTransactionalConfirmText}
                                    onChange={(e) => setDeleteTransactionalConfirmText(e.target.value)}
                                    className="mt-2"
                                    placeholder="delete transactional data"
                                />
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setDeleteTransactionalConfirmText('')}>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                    onClick={handleDeleteTransactionalData} 
                                    className="bg-destructive hover:bg-destructive/90"
                                    disabled={deleteTransactionalConfirmText !== 'delete transactional data'}
                                >
                                    Continue
                                </AlertDialogAction>
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
                                Delete
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
                </div>
            </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
