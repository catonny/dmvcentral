

import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import 'dotenv/config';
import {
  employees,
  clients,
  engagementTypes,
  engagements,
  countries,
  departments,
  clientCategories,
  timesheets,
  engagementIdMapForTimesheet,
} from '@/lib/data';
import type { Task, AuditTemplate } from '@/lib/data';


// This will be automatically populated by the Firebase environment in production,
// but for a local script, we need to explicitly load it.
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : undefined;

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

const auditTemplates: Omit<AuditTemplate, 'id'>[] = [
    // Part A
    { name: "Audit Planning", part: "A", description: "Covers the objectives, scope, and planning process." },
    { name: "Entity Level Controls", part: "A", description: "Reviews ethics, governance, and board oversight." },
    { name: "Business Controls Diagnostic", part: "A", description: "Identifies process risks and control effectiveness." },
    { name: "Financial Statement Closure Process", part: "A", description: "Ensures accuracy in financial closing." },
    { name: "Annual Operating Plan", part: "A", description: "Audits the budgeting and planning process." },
    { name: "Management Information System", part: "A", description: "Checks the reliability of management reporting." },
    { name: "IT Internal Controls", part: "A", description: "A deep dive into technology security, access, and operations." },
    { name: "Standards on Internal Audit (SIAs) Compliances", part: "A", description: "Ensures adherence to professional standards." },
    { name: "Legal and Statutory Compliances", part: "A", description: "Verifies compliance with applicable laws." },
    { name: "Operational and Administrative Expenses", part: "A", description: "Audits general business expenditures." },
    { name: "Government Grants", part: "A", description: "Covers the receipt and utilization of grants." },
    { name: "Patents and Copyright", part: "A", description: "Manages intellectual property risks." },
    { name: "Business Continuity Plan", part: "A", description: "Assesses disaster recovery and continuity planning." },
    { name: "Related Party Transactions", part: "A", description: "Reviews transactions with related entities for compliance." },
    { name: "Audit Conclusion", part: "A", description: "The final wrap-up and reporting checklist." },
    // Part B
    { name: "Order to Cash – Manufacturing", part: "B", description: "The complete sales cycle for goods." },
    { name: "Order to Cash – Services", part: "B", description: "The sales cycle for service-based businesses." },
    { name: "Purchase to Pay – Direct Material", part: "B", description: "Procurement process for raw materials." },
    { name: "Purchase to Pay – Indirect Material and Services", part: "B", description: "Procurement for operational supplies and services." },
    { name: "Purchase to Pay – Capital Items", part: "B", description: "The process for acquiring large capital assets." },
    { name: "Fixed Assets and Capex", part: "B", description: "Management of fixed assets and capital expenditures." },
    { name: "Project Management", part: "B", description: "Oversight for large-scale internal projects." },
    { name: "Inventory Management", part: "B", description: "Covers warehousing, stock levels, and verification." },
    { name: "Cash and Bank", part: "B", description: "Management of cash transactions and bank reconciliations." },
    { name: "Treasury Management", part: "B", description: "Audits investments, hedging, and fund management." },
    { name: "Borrowings", part: "B", description: "Covers loans and debt management." },
    { name: "Direct and Indirect Taxation & GST", part: "B", description: "Tax compliance for all major areas." },
    { name: "Corporate Social Responsibility", part: "B", description: "Audits CSR committee functions and expenditures." },
    { name: "Human Resources – Hire to Retire", part: "B", description: "The complete employee lifecycle." },
    { name: "Human Resources – Payroll Management", part: "B", description: "Focuses on payroll processing and compliance." },
    { name: "Foreign Currency Transactions", part: "B", description: "Manages risks related to forex." },
];


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
        'auditTemplates',
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
    clients.forEach((client, index) => {
      const docRef = db.collection('clients').doc();
      const now = new Date();
      // Go back 1 to 3 years for creation date
      const createdAt = new Date(now.setFullYear(now.getFullYear() - (1 + Math.floor(Math.random() * 3)))).toISOString();
      batch.set(docRef, { ...client, id: docRef.id, createdAt: createdAt, lastUpdated: new Date().toISOString() });
      clientRefs[`client${index + 1}_id_placeholder`] = {id: docRef.id, partnerId: client.partnerId};
    });

    console.log('Seeding engagement types...');
    engagementTypes.forEach((type) => {
      const docRef = db.collection('engagementTypes').doc(type.id);
      batch.set(docRef, type);
    });
    
    console.log('Seeding audit templates...');
    auditTemplates.forEach((template) => {
        const docRef = db.collection('auditTemplates').doc();
        batch.set(docRef, { ...template, id: docRef.id });
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
          const newEngagementData = { ...engagement, id: engagementDocRef.id, clientId: clientRefData.id, engagementCategory: 'External' as const };
          batch.set(engagementDocRef, newEngagementData);

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
