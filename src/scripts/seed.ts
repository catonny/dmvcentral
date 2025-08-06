

import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import 'dotenv/config';
import {
  employees,
  clients as clientData,
  engagementTypes,
  engagements,
  countries,
  departments,
  clientCategories,
  timesheets,
  engagementIdMapForTimesheet,
} from '@/lib/data';
import type { Task } from '@/lib/data';


// This will be automatically populated by the Firebase environment in production,
// but for a local script, we need to explicitly load it.
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;

let serviceAccount: any;
if (serviceAccountString) {
    try {
        serviceAccount = JSON.parse(serviceAccountString);
    } catch (e) {
        console.error("Error parsing FIREBASE_SERVICE_ACCOUNT JSON string:", e);
        serviceAccount = undefined;
    }
}


if (!serviceAccount) {
    throw new Error('Firebase Admin SDK service account is not defined. Make sure the FIREBASE_SERVICE_ACCOUNT environment variable is set.');
}

let app: App;

// Initialize Firebase Admin SDK
if (!getApps().length) {
  app = initializeApp({
    credential: cert(serviceAccount),
  });
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

const seedDatabase = async () => {
  console.log('Starting database seed...');
  try {
    const batch = db.batch();

    const collectionsToDelete = [
        'employees',
        'clients',
        'engagementTypes',
        'clientCategories',
        'departments',
        'countries',
        'engagements',
        'tasks',
        'pendingInvoices',
        'timesheets',
        'chatMessages',
        'communications',
        'leaveRequests',
    ];

    console.log('Deleting existing data...');
    for (const collectionName of collectionsToDelete) {
        const snapshot = await db.collection(collectionName).get();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
    }
    console.log('Existing data marked for deletion.');


    const clientRefs: { [key: string]: { id: string, partnerId: string} } = {};
    const engagementTypeMap = new Map(engagementTypes.map(et => [et.id, et]));
    const realEngagementIdMap = new Map<string, string>();

    console.log('Seeding employees...');
    employees.forEach((employee) => {
      const docRef = db.collection('employees').doc(employee.id);
      batch.set(docRef, employee);
    });

    console.log('Seeding clients...');
    clientData.forEach((client, index) => {
      const docRef = db.collection('clients').doc();
      const now = new Date();
      // Go back 1 to 3 years for creation date
      const createdAt = new Date(now.setFullYear(now.getFullYear() - (1 + Math.floor(Math.random() * 3)))).toISOString();
      
      const newClient = {
            name: client.name,
            pan: client.pan,
            mobileNumber: client.mobileNumber,
            mailId: client.mailId,
            partnerId: client.partnerId,
            category: client.category,
            country: client.country,
            gstin: client.gstin,
            contactPerson: client.contactPerson,
            contactPersonDesignation: client.contactPersonDesignation,
            id: docRef.id,
            createdAt: createdAt,
            lastUpdated: new Date().toISOString()
      };
      
      batch.set(docRef, newClient);
      clientRefs[`client${index + 1}_id_placeholder`] = {id: docRef.id, partnerId: client.partnerId};
    });

    console.log('Seeding engagement types...');
    engagementTypes.forEach((type) => {
      const docRef = db.collection('engagementTypes').doc(type.id);
      batch.set(docRef, type);
    });

    console.log('Seeding client categories...');
    clientCategories.forEach((category) => {
      const docRef = db.collection('clientCategories').doc();
      batch.set(docRef, { id: docRef.id, name: category });
    });

    console.log('Seeding departments...');
    departments.forEach((department) => {
      const docRef = db.collection('departments').doc();
      batch.set(docRef, { ...department, id: docRef.id });
    });

    console.log('Seeding countries...');
    countries.forEach((country) => {
      const docRef = db.collection('countries').doc(country.code);
      batch.set(docRef, country);
    });

    console.log('Seeding engagements and tasks...');
    engagements.forEach((engagement) => {
        const clientRefData = clientRefs[engagement.clientId];
        if (clientRefData) {
          const engagementDocRef = db.collection('engagements').doc();
          batch.set(engagementDocRef, { ...engagement, id: engagementDocRef.id, clientId: clientRefData.id });

          const timesheetPlaceholder = Object.keys(engagementIdMapForTimesheet).find(
              key => engagementIdMapForTimesheet[key as keyof typeof engagementIdMapForTimesheet].remarks === engagement.remarks
          );
          if (timesheetPlaceholder) {
              realEngagementIdMap.set(timesheetPlaceholder, engagementDocRef.id);
          }

          if (engagement.billStatus === "To Bill") {
              const pendingInvoiceRef = db.collection("pendingInvoices").doc();
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
                  const taskDocRef = db.collection('tasks').doc();
                  const newTask: Task = {
                      id: taskDocRef.id,
                      engagementId: engagementDocRef.id,
                      title: taskTitle,
                      status: 'Pending',
                      order: taskIndex + 1,
                      assignedTo: engagement.assignedTo[0] || '',
                  };
                  batch.set(taskDocRef, newTask);
              });
          }
        } else {
          console.warn(`Could not find new client ID for placeholder: ${engagement.clientId}`);
        }
    });

    console.log('Seeding timesheets...');
    timesheets.forEach(ts => {
      const employee = employees.find(e => e.id === ts.userId);
      if (employee) {
          const timesheetId = `${ts.userId}_${ts.weekStartDate.substring(0,10)}`;
          const timesheetRef = db.collection('timesheets').doc(timesheetId);

          const updatedEntries = ts.entries.map(entry => ({
              ...entry,
              engagementId: realEngagementIdMap.get(entry.engagementId) || entry.engagementId,
          }));

          batch.set(timesheetRef, {
              ...ts,
              id: timesheetId,
              userName: employee.name,
              isPartner: employee.role.includes("Partner"),
              entries: updatedEntries
          });
      }
    });


    console.log('Committing batch to database...');
    await batch.commit();
    console.log('Database successfully seeded!');
    console.log('You can now start the application with `npm run dev`');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
