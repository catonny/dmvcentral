

'use client';

import * as React from 'react';
import { writeBatch, doc, collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  employees,
  clients,
  engagementTypes,
  engagements,
  tasks, // import the new tasks
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
                setIsSeeded(true);
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
      const clientRefs: { [key: string]: string } = {};
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
        clientRefs[`client${index + 1}_id_placeholder`] = docRef.id;
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
          const newClientId = clientRefs[engagement.clientId];
          if (newClientId) {
            const engagementDocRef = doc(collection(db, 'engagements'));
            batch.set(engagementDocRef, { ...engagement, id: engagementDocRef.id, clientId: newClientId });
            
            // Now, create the sub-tasks for this engagement from the template
            const template = engagementTypeMap.get(engagement.type);
            if (template && template.subTaskTitles) {
                template.subTaskTitles.forEach((taskTitle, taskIndex) => {
                    const taskDocRef = doc(collection(db, 'tasks'));
                    batch.set(taskDocRef, {
                        id: taskDocRef.id,
                        engagementId: engagementDocRef.id,
                        title: taskTitle,
                        status: 'Pending', // All tasks start as pending
                        order: taskIndex + 1,
                    });
                });
            }
          } else {
            console.warn(`Could not find new client ID for placeholder: ${engagement.clientId}`);
          }
      });


      await batch.commit();
      
      toast({
        title: 'Database Seeded',
        description: 'Your Firestore database has been populated with initial data.',
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
            This action will populate your Firestore database with the initial sample data.
            This should only be done once.
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
                            Seeding...
                        </>
                    ) : (
                        'Seed Database'
                    )}
                </Button>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
