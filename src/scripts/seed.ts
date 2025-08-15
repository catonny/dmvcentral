

import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import 'dotenv/config';
import {
  employees as defaultEmployees,
  clients as clientData,
  engagementTypes,
  engagements,
  countries,
  departments,
  clientCategories,
  timesheets,
  engagementIdMapForTimesheet,
  ALL_FEATURES,
  firms,
  taxRates,
} from '@/lib/data';
import type { Task, Permission, Employee, HsnSacCode, SalesItem } from '@/lib/data';


// This will be automatically populated by the Firebase environment in production,
// but for a local script, we need to explicitly load it.
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;


if (!serviceAccountString) {
    throw new Error('Firebase Admin SDK service account is not defined. Make sure the FIREBASE_SERVICE_ACCOUNT environment variable is set correctly.');
}

const serviceAccount = JSON.parse(serviceAccountString);

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

export const seedDatabase = async () => {
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
        'invoices',
        'timesheets',
        'chatMessages',
        'communications',
        'leaveRequests',
        'events',
        'permissions',
        'firms',
        'activityLog',
        'taxRates',
        'hsnSacCodes',
        'salesItems',
        'recurringEngagements',
        'todos',
        '_metadata',
        'bonuses'
    ];

    console.log('Deleting existing data...');
    for (const collectionName of collectionsToDelete) {
        const snapshot = await db.collection(collectionName).get();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
    }
    console.log('Existing data marked for deletion.');
    
    const adminUser: Employee = {
        id: "S001",
        name: "Tonny Varghese",
        email: "ca.tonnyvarghese@gmail.com",
        designation: "Founder & CEO",
        avatar: "https://placehold.co/40x40.png",
        role: ["Admin", "Partner"],
        leaveAllowance: 24,
        leavesTaken: 0,
        monthlySalary: 500000,
        chargeOutRate: 5000,
    };
    
    const employees = [adminUser, ...defaultEmployees];


    const firmRefs: { [key: string]: string } = {};
    const clientRefs: { [key: string]: { id: string, partnerId: string} } = {};
    const engagementTypeMap = new Map(engagementTypes.map(et => [et.id, et]));
    const realEngagementIdMap = new Map<string, string>();
    
    console.log('Seeding firms...');
    firms.forEach(firm => {
        const docRef = db.collection('firms').doc();
        batch.set(docRef, { ...firm, id: docRef.id });
        // Assuming only one firm for now for seed data
        firmRefs["firm_id_placeholder"] = docRef.id;
    });

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
            ...client,
            firmId: firmRefs["firm_id_placeholder"], // Link client to the seeded firm
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
      // Use department name as the ID to prevent duplicates
      const docRef = db.collection('departments').doc(department.name);
      batch.set(docRef, { ...department, id: docRef.id });
    });
    
    console.log('Seeding tax rates...');
    let defaultTaxRateId = '';
    taxRates.forEach(rate => {
        const docRef = db.collection('taxRates').doc();
        const newRate = {...rate, id: docRef.id };
        if (rate.isDefault) {
            defaultTaxRateId = docRef.id;
        }
        batch.set(docRef, newRate);
    });

    console.log('Seeding HSN/SAC codes...');
    let defaultSacId = '';
    const hsnSacCodes: Omit<HsnSacCode, 'id'>[] = [
        { code: '998314', description: 'Legal and accounting services', type: 'SAC', isDefault: true },
        { code: '998221', description: 'Business consulting services', type: 'SAC' },
    ];
    hsnSacCodes.forEach(code => {
        const docRef = db.collection('hsnSacCodes').doc();
        const newCode = { ...code, id: docRef.id };
         if (code.isDefault) {
            defaultSacId = docRef.id;
        }
        batch.set(docRef, newCode);
    });

    console.log('Seeding sales items...');
    const salesItems: Omit<SalesItem, 'id'>[] = [
        { name: 'Statutory Audit Fee', description: 'Fee for statutory audit services.', standardPrice: 50000, defaultTaxRateId: defaultTaxRateId, defaultSacId: defaultSacId },
        { name: 'ITR Filing Fee', description: 'Fee for income tax return filing.', standardPrice: 5000, defaultTaxRateId: defaultTaxRateId, defaultSacId: defaultSacId },
    ];
     salesItems.forEach(item => {
        const docRef = db.collection('salesItems').doc();
        batch.set(docRef, { ...item, id: docRef.id });
    });

    console.log('Seeding default permissions...');
    const permissions: Permission[] = [
        { feature: 'reports', departments: ['Admin', 'Partner'] },
        { feature: 'administration', departments: ['Admin', 'Partner', 'Administration'] },
        { feature: 'timesheet', departments: ['Admin', 'Partner'] },
        { feature: 'calendar', departments: ['Admin', 'Partner', 'Manager', 'Employee', 'Articles', 'Administration'] },
        { feature: 'inbox', departments: ['Admin', 'Partner', 'Manager', 'Employee', 'Articles', 'Administration'] },
        { feature: 'firm-analytics', departments: ['Admin', 'Partner'] },
        { feature: 'leave-management', departments: ['Admin', 'Partner', 'Manager'] },
        { feature: 'masters', departments: ['Admin'] },
        { feature: 'bulk-import', departments: ['Admin'] },
        { feature: 'employee-management', departments: ['Admin'] },
        { feature: 'workflow-editor', departments: ['Admin'] },
        { feature: 'settings-data-management', departments: ['Admin'] },
        { feature: 'settings-access-control', departments: ['Admin'] },
    ];

    permissions.forEach(perm => {
        const docRef = db.collection('permissions').doc(perm.feature);
        batch.set(docRef, perm);
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
          const newEngagement = { ...engagement, id: engagementDocRef.id, clientId: clientRefData.id, financialYear: engagement.financialYear || "2024-25" };
          batch.set(engagementDocRef, newEngagement);

          // Log creation
          const activityLogRef = db.collection('activityLog').doc();
          batch.set(activityLogRef, {
              id: activityLogRef.id,
              engagementId: newEngagement.id,
              clientId: newEngagement.clientId,
              type: 'CREATE_ENGAGEMENT',
              timestamp: new Date().toISOString(),
              userId: adminUser.id, // Assume admin creates all seed data
              userName: adminUser.name,
              details: {
                  engagementName: newEngagement.remarks,
              },
          });

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
// This allows the script to be importable and not run automatically
if (require.main === module) {
    seedDatabase();
}
