

'use client';

import * as React from 'react';
import { writeBatch, doc, collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  employees,
  clients,
  engagementTypes,
  engagements,
  tasks,
  countries,
  departments,
  clientCategories
} from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SeedPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [isSeeded, setIsSeeded] = React.useState(false);

  React.useEffect(() => {
    const checkSeeded = async () => {
        try {
            const q = query(collection(db, "employees"));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                // This doesn't prevent re-seeding, just changes the UI message.
                // The button will now be a "Reset and Seed" button.
            }
        } catch (e) {
            console.error("Could not check if db is seeded", e)
        }
    }
    checkSeeded();
  }, [])

  const handleSeedDatabase = async () => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      // ---- DELETION LOGIC ----
      // These are all the collections managed by the seed script.
      // Note: 'permissions' are managed by the admin UI and are not cleared here.
      const collectionsToDelete = [
          'employees', 
          'clients', 
          'engagementTypes', 
          'clientCategories', 
          'departments', 
          'countries', 
          'engagements', 
          'tasks', 
          'pendingInvoices'
      ];
      
      for (const collectionName of collectionsToDelete) {
          const snapshot = await getDocs(collection(db, collectionName));
          snapshot.docs.forEach(doc => batch.delete(doc.ref));
      }
      
      // ---- CREATION LOGIC ----
      const clientRefs: { [key: string]: { id: string, partnerId: string} } = {};
      const engagementTypeMap = new Map(engagementTypes.map(et => [et.id, et]));

      // Seed Employees
      employees.forEach((employee) => {
        const docRef = doc(db, 'employees', employee.id);
        batch.set(docRef, employee);
      });

      // Seed Clients and store their new IDs
      clients.forEach((client, index) => {
        const docRef = doc(collection(db, 'clients'));
        batch.set(docRef, { ...client, id: docRef.id, lastUpdated: new Date().toISOString() });
        clientRefs[`client${index + 1}_id_placeholder`] = {id: docRef.id, partnerId: client.partnerId};
      });

      // Seed Engagement Types (which are now templates)
      engagementTypes.forEach((type) => {
        const docRef = doc(db, 'engagementTypes', type.id);
        batch.set(docRef, type);
      });
      
      // Seed Client Categories
      clientCategories.forEach((category) => {
        const docRef = doc(collection(db, 'clientCategories'));
        batch.set(docRef, { id: docRef.id, name: category });
      });

      // Seed Departments
      departments.forEach((department) => {
        const docRef = doc(collection(db, 'departments'));
        batch.set(docRef, { ...department, id: docRef.id });
      });

      // Seed Countries
      countries.forEach((country) => {
        const docRef = doc(db, 'countries', country.code);
        batch.set(docRef, country);
      });
      
      // Seed Engagements and their related Tasks
      engagements.forEach((engagement, index) => {
          const clientRefData = clientRefs[engagement.clientId];
          if (clientRefData) {
            const engagementDocRef = doc(collection(db, 'engagements'));
            const newEngagementData = { ...engagement, id: engagementDocRef.id, clientId: clientRefData.id };
            batch.set(engagementDocRef, newEngagementData);
            
            if (engagement.billStatus === "To Bill") {
                const pendingInvoiceRef = doc(collection(db, "pendingInvoices"));
                batch.set(pendingInvoiceRef, {
                    id: pendingInvoiceRef.id,
                    engagementId: engagementDocRef.id,
                    clientId: clientRefData.id,
                    assignedTo: engagement.assignedTo,
                    reportedTo: engagement.reportedTo,
                    partnerId: clientRefData.partnerId,
                });
            }
            
            const template = engagementTypeMap.get(engagement.type);
            if (template && template.subTaskTitles) {
                template.subTaskTitles.forEach((taskTitle, taskIndex) => {
                    const taskDocRef = doc(collection(db, 'tasks'));
                    batch.set(taskDocRef, {
                        id: taskDocRef.id,
                        engagementId: engagementDocRef.id,
                        title: taskTitle,
                        status: 'Pending',
                        order: taskIndex + 1,
                        assignedTo: engagement.assignedTo[0] || '', // Assign task to first person on engagement
                    });
                });
            }
          } else {
            console.warn(`Could not find new client ID for placeholder: ${engagement.clientId}`);
          }
      });


      await batch.commit();
      
      toast({
        title: 'Database Reset and Seeded',
        description: 'Your Firestore database has been cleared and populated with fresh sample data.',
      });
      setIsSeeded(true);
    } catch (error) {
      console.error('Error seeding database:', error);
      toast({
        title: 'Error',
        description: 'Failed to seed database. Check the console for details.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-headline">Seed Database</CardTitle>
          <CardDescription>
            This action will first <span className="font-bold text-destructive">delete all existing data</span> (clients, employees, engagements, etc.) and then populate your Firestore database with the initial sample data.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
            {isSeeded ? (
                <div className="text-center p-4 bg-green-100 dark:bg-green-900/50 rounded-md">
                    <p className="font-semibold text-green-800 dark:text-green-200">Database has been successfully seeded!</p>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-2">You can now navigate back to the login page.</p>
                     <Button asChild className="mt-4">
                        <Link href="/login">Go to Login</Link>
                    </Button>
                </div>
            ) : (
                 <Button onClick={handleSeedDatabase} disabled={loading} className="w-full">
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Resetting and Seeding...
                        </>
                    ) : (
                        'Reset and Seed Database'
                    )}
                </Button>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
