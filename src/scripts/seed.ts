
import 'dotenv/config';
import { db } from '@/lib/db';
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
  hsnSacCodes,
  salesItems,
} from '@/lib/data';
import type { Task, Permission, Employee, HsnSacCode, SalesItem } from '@/lib/data';

// This will be automatically populated by the Firebase environment in production,
// but for a local script, we need to explicitly load it.
if (!process.env.SUPABASE_POSTGRES_URL) {
    throw new Error('Database connection string is not set. Please set SUPABASE_POSTGRES_URL in your .env file.');
}

export const seedDatabase = async () => {
  console.log('Starting database seed for PostgreSQL...');
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    console.log('Transaction started.');

    // List of tables to truncate, in an order that respects foreign keys
    const tablesToDelete = [
      'activity_log', 'tasks', 'timesheet_entries', 'timesheets', 'pending_invoices', 'invoice_line_items', 'invoices', 'recurring_engagements', 'todos', 'engagements', 
      'clients', 'employees', 'firms', 'departments', 'engagement_types', 'client_categories', 'countries', 'permissions', 'tax_rates', 'hsn_sac_codes', 'sales_items', 
      'engagement_notes', 'chat_messages', 'chat_threads', 'calendar_events', 'leave_requests'
    ];
    
    console.log('Truncating existing tables...');
    for (const tableName of tablesToDelete) {
        // Using TRUNCATE ... CASCADE to handle foreign key dependencies automatically
        // Check if table exists before truncating to avoid errors on first run
        const res = await client.query(`SELECT to_regclass('public."${tableName}"');`);
        if (res.rows[0].to_regclass) {
            await client.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`);
        }
    }
    console.log('Existing data truncated.');

    const adminUser: Employee = {
        id: "S001",
        name: "Tonny Varghese",
        email: "ca.tonnyvarghese@gmail.com",
        designation: "Founder & CEO",
        avatar: "https://placehold.co/40x40.png",
        role: ["Admin", "Partner"],
        leaveAllowance: 24,
        leavesTaken: 0,
    };
    const employees = [adminUser, ...defaultEmployees];
    
    // Seed Firms
    console.log('Seeding firms...');
    const firmResult = await client.query(
      `INSERT INTO firms (id, name, pan, gstn, email, "contactNumber", website, "billingAddressLine1", "billingAddressLine2", state, country) VALUES ('firm_1', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [firms[0].name, firms[0].pan, firms[0].gstn, firms[0].email, firms[0].contactNumber, firms[0].website, firms[0].billingAddressLine1, firms[0].billingAddressLine2, firms[0].state, firms[0].country]
    );
    const firmId = firmResult.rows[0].id;

    // Seed Departments
    console.log('Seeding departments...');
    for (const dept of departments) {
      await client.query('INSERT INTO departments (id, name, "order") VALUES ($1, $2, $3)', [dept.name, dept.name, dept.order]);
    }

    // Seed Employees
    console.log('Seeding employees...');
    for (const emp of employees) {
      await client.query(
        'INSERT INTO employees (id, name, email, designation, avatar, role, "leaveAllowance", "leavesTaken", "managerId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [emp.id, emp.name, emp.email, emp.designation, emp.avatar, emp.role, emp.leaveAllowance, emp.leavesTaken, emp.managerId]
      );
    }
    
    // Seed Clients
    console.log('Seeding clients...');
    for (const c of clientData) {
        const now = new Date();
        const createdAt = new Date(now.setFullYear(now.getFullYear() - (1 + Math.floor(Math.random() * 3)))).toISOString();
        await client.query(
            `INSERT INTO clients (name, "mailId", "mobileNumber", category, "partnerId", "firmId", pan, gstin, "createdAt", "lastUpdated") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [c.name, c.mailId, c.mobileNumber, c.category, c.partnerId, firmId, c.pan, c.gstin, createdAt, new Date().toISOString()]
        );
    }
    const allClientsResult = await client.query('SELECT id, name FROM clients');
    const clientNameToIdMap = new Map(allClientsResult.rows.map(row => [row.name, row.id]));


    // Seed Engagement Types
    console.log('Seeding engagement types...');
    for (const et of engagementTypes) {
      await client.query(
        'INSERT INTO engagement_types (id, name, description, "subTaskTitles", recurrence, "applicableCategories") VALUES ($1, $2, $3, $4, $5, $6)',
        [et.id, et.name, et.description, et.subTaskTitles, et.recurrence, et.applicableCategories]
      );
    }

    // Seed Engagements and Tasks
    console.log('Seeding engagements and tasks...');
    
    for (const eng of engagements) {
        const clientName = clientMapForEngagement(eng.clientId);
        const clientId = clientName ? clientNameToIdMap.get(clientName) : undefined;
        if (clientId) {
            const engagementResult = await client.query(
                `INSERT INTO engagements ("clientId", remarks, type, "assignedTo", "reportedTo", "dueDate", status, fees, "billStatus") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                [clientId, eng.remarks, eng.type, eng.assignedTo, eng.reportedTo, eng.dueDate, eng.status, eng.fees, eng.billStatus]
            );
            const engagementId = engagementResult.rows[0].id;
            
            const template = engagementTypes.find(et => et.id === eng.type);
            if (template?.subTaskTitles) {
                for (const [index, title] of template.subTaskTitles.entries()) {
                    await client.query(
                        `INSERT INTO tasks ("engagementId", title, status, "order", "assignedTo") VALUES ($1, $2, $3, $4, $5)`,
                        [engagementId, title, 'Pending', index + 1, eng.assignedTo[0] || null]
                    );
                }
            }
        }
    }

    const allEngagementsResult = await client.query('SELECT id, remarks FROM engagements');
    const engagementRemarksToIdMap = new Map(allEngagementsResult.rows.map(row => [row.remarks, row.id]));

    // Seed Timesheets and Entries
    console.log('Seeding timesheets and entries...');
    for (const ts of timesheets) {
        const timesheetId = `${ts.userId}_${new Date(ts.weekStartDate).toISOString().split('T')[0]}`;
        const employee = employees.find(e => e.id === ts.userId);
        if (employee) {
             await client.query(
                `INSERT INTO timesheets (id, "userId", "userName", "isPartner", "weekStartDate", "totalHours") VALUES ($1, $2, $3, $4, $5, $6)`,
                [timesheetId, ts.userId, employee.name, employee.role.includes("Partner"), ts.weekStartDate, ts.totalHours]
            );

            for (const entry of ts.entries) {
                const engagementData = engagementIdMapForTimesheet[entry.engagementId];
                if (engagementData) {
                    const engagementId = engagementRemarksToIdMap.get(engagementData.remarks);
                    if (engagementId) {
                         await client.query(
                            `INSERT INTO timesheet_entries (timesheet_id, engagement_id, hours, description) VALUES ($1, $2, $3, $4)`,
                            [timesheetId, engagementId, entry.hours, entry.description]
                         );
                    }
                }
            }
        }
    }
    
    console.log('Seeding permissions...');
    for (const perm of ALL_FEATURES) {
      await client.query(`INSERT INTO permissions (feature, departments) VALUES ($1, $2)`, [perm.id, ['Admin']]);
    }
    
    await client.query('COMMIT');
    console.log('Transaction committed.');
    console.log('Database successfully seeded!');
    console.log('You can now start the application with `npm run dev`');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding database, transaction rolled back:', error);
    process.exit(1);
  } finally {
    client.release();
    await db.end();
  }
};

// Helper to map old placeholder client IDs to names for lookup
const clientMapForEngagement = (placeholderId: string): string | undefined => {
    const mapping: {[key: string]: string} = {
        "client1_id_placeholder": "Innovate Inc.",
        "client2_id_placeholder": "GreenFuture LLP",
        "client3_id_placeholder": "Hope Foundation"
    }
    return mapping[placeholderId];
}


// This allows the script to be importable and not run automatically
if (require.main === module) {
    seedDatabase();
}
