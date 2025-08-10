
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
import type { Task, Permission, Employee, HsnSacCode, SalesItem, Timesheet } from '@/lib/data';

// This will be automatically populated by the Firebase environment in production,
// but for a local script, we need to explicitly load it.
if (!process.env.SUPABASE_POSTGRES_URL) {
    throw new Error('Database connection string is not set. Please set SUPABASE_POSTGRES_URL in your .env file.');
}

const clientNameToIdMap = new Map<string, string>();

export const seedDatabase = async () => {
  console.log('Starting database seed for PostgreSQL...');
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    console.log('Transaction started.');

    // List of tables to truncate, in an order that respects foreign keys
    const tablesToDelete = [
      'activity_log', 'timesheet_entries', 'timesheets', 'tasks', 'pending_invoices', 'invoice_line_items', 'invoices', 'recurring_engagements', 'todos', 'engagements', 
      'clients', 'employees', 'firms', 'departments', 'engagement_types', 'client_categories', 'countries', 'permissions', 'tax_rates', 'hsn_sac_codes', 'sales_items', 
      'engagement_notes', 'chat_messages', 'chat_threads', 'calendar_events', 'leave_requests'
    ];
    
    console.log('Truncating existing tables...');
    for (const tableName of tablesToDelete) {
        const res = await client.query(`SELECT to_regclass('public."${tableName}"');`);
        if (res.rows[0].to_regclass) {
            await client.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE;`);
        }
    }
    console.log('Existing data truncated.');

    // Seed Firms
    console.log('Seeding firms...');
    const firmData = firms[0];
    await client.query(
      `INSERT INTO firms (id, name, pan, gstn, email, contact_number, website, billing_address_line1, billing_address_line2, state, country) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [firmData.id, firmData.name, firmData.pan, firmData.gstn, firmData.email, firmData.contactNumber, firmData.website, firmData.billingAddressLine1, firmData.billingAddressLine2, firmData.state, firmData.country]
    );

    // Seed Departments
    console.log('Seeding departments...');
    for (const dept of departments) {
      const deptResult = await client.query('INSERT INTO departments (name, "order") VALUES ($1, $2) RETURNING id', [dept.name, dept.order]);
      await client.query('UPDATE departments SET id = $1 WHERE id = $1', [deptResult.rows[0].id]);
    }
    
    // Seed Employees
    console.log('Seeding employees...');
    const employees = [...defaultEmployees];
    for (const emp of employees) {
      await client.query(
        'INSERT INTO employees (id, name, email, designation, avatar, role, "leave_allowance", "leaves_taken", "manager_id", linkedin, "emergency_contact", "blood_group") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
        [emp.id, emp.name, emp.email, emp.designation, emp.avatar, emp.role, emp.leaveAllowance, emp.leavesTaken, emp.managerId, emp.linkedin, emp.emergencyContact, emp.bloodGroup]
      );
    }
    
    // Seed Countries
    console.log('Seeding countries...');
    for (const country of countries) {
        await client.query('INSERT INTO countries (code, name) VALUES ($1, $2)', [country.code, country.name]);
    }

    // Seed Client Categories
    console.log('Seeding client categories...');
    for (const [index, category] of clientCategories.entries()) {
        await client.query('INSERT INTO client_categories (id, name) VALUES ($1, $2)', [`CAT${index + 1}`, category]);
    }

    // Seed Engagement Types
    console.log('Seeding engagement types...');
    for (const et of engagementTypes) {
      await client.query(
        'INSERT INTO engagement_types (id, name, description, "sub_task_titles", recurrence, "applicable_categories") VALUES ($1, $2, $3, $4, $5, $6)',
        [et.id, et.name, et.description, et.subTaskTitles, et.recurrence, et.applicableCategories]
      );
    }
    
    // Seed Tax Rates
    console.log('Seeding tax rates...');
    const taxRateResults = [];
    for (const rate of taxRates) {
        const res = await client.query('INSERT INTO tax_rates (name, rate, "is_default") VALUES ($1, $2, $3) RETURNING id', [rate.name, rate.rate, rate.isDefault || false]);
        const newId = res.rows[0].id;
        await client.query('UPDATE tax_rates SET id = $1 WHERE id = $1', [newId]);
        taxRateResults.push({ ...rate, id: newId });
    }
    const defaultTaxRateId = taxRateResults.find(r => r.isDefault)?.id;
    
    // Seed HSN/SAC Codes
    console.log('Seeding HSN/SAC codes...');
    const hsnSacResult = await client.query(`INSERT INTO hsn_sac_codes (code, description, type, "is_default") VALUES ('998314', 'Other professional, technical and business services', 'SAC', true) RETURNING id`);
    const defaultSacId = hsnSacResult.rows[0].id;
     await client.query('UPDATE hsn_sac_codes SET id = $1 WHERE id = $1', [defaultSacId]);

    // Seed Sales Items
    console.log('Seeding sales items...');
    for (const item of salesItems) {
        const salesItemResult = await client.query(
            `INSERT INTO sales_items (name, description, "standard_price", "default_tax_rate_id", "default_sac_id") VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [item.name, item.description, item.standardPrice, defaultTaxRateId, defaultSacId]
        );
        const newSalesItemId = salesItemResult.rows[0].id;
        await client.query('UPDATE sales_items SET id = $1 WHERE id = $1', [newSalesItemId]);
    }
    
    // Seed Clients
    console.log('Seeding clients...');
    for (const c of clientData) {
        const now = new Date();
        const createdAt = new Date(now.setFullYear(now.getFullYear() - (1 + Math.floor(Math.random() * 3)))).toISOString();
        const clientResult = await client.query(
            `INSERT INTO clients (name, mail_id, mobile_number, category, partner_id, firm_id, pan, gstin, created_at, last_updated) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [c.name, c.mailId, c.mobileNumber, c.category, c.partnerId, c.firmId, c.pan, c.gstin, createdAt, new Date().toISOString()]
        );
        const newClientId = clientResult.rows[0].id;
        
        const placeholderId = `client${clientData.indexOf(c) + 1}_id_placeholder`;
        clientNameToIdMap.set(placeholderId, newClientId);
    }
    const allClientsResult = await client.query('SELECT id, name FROM clients');
    const clientNameMap = new Map(allClientsResult.rows.map(row => [row.name, row.id]));


    // Seed Engagements and Tasks
    console.log('Seeding engagements and tasks...');
    
    for (const eng of engagements) {
        const clientName = clientMapForEngagement(eng.clientId);
        const clientId = clientName ? clientNameMap.get(clientName) : undefined;
        if (clientId) {
            const engagementResult = await client.query(
                `INSERT INTO engagements ("client_id", remarks, type, "assigned_to", "reported_to", "due_date", status, fees, "bill_status") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                [clientId, eng.remarks, eng.type, eng.assignedTo, eng.reportedTo, eng.dueDate, eng.status, eng.fees, eng.billStatus]
            );
            const engagementId = engagementResult.rows[0].id;
            
            const template = engagementTypes.find(et => et.id === eng.type);
            if (template?.subTaskTitles) {
                for (const [index, title] of template.subTaskTitles.entries()) {
                    await client.query(
                        `INSERT INTO tasks ("engagement_id", title, status, "order", "assigned_to") VALUES ($1, $2, $3, $4, $5)`,
                        [engagementId, title, 'Pending', index + 1, eng.assignedTo[0] || null]
                    );
                }
            }
        }
    }
    
     // Seed Timesheets
    console.log('Seeding timesheets...');
    const allEngagementsResult = await client.query('SELECT id, remarks FROM engagements');
    const engagementRemarksToIdMap = new Map(allEngagementsResult.rows.map(row => [row.remarks, row.id]));
    
    for (const sheet of timesheets) {
        const timesheetId = `${sheet.userId}_${sheet.weekStartDate.split('T')[0]}`;
        const employee = employees.find(e => e.id === sheet.userId);
        if (!employee) continue;

        const timesheetResult = await client.query(
            `INSERT INTO timesheets (id, user_id, user_name, "is_partner", "week_start_date", total_hours) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [timesheetId, sheet.userId, employee.name, employee.role.includes("Partner"), sheet.weekStartDate, sheet.totalHours]
        );
        const newTimesheetId = timesheetResult.rows[0].id;

        for (const entry of sheet.entries) {
            const engagementPlaceholder = engagementIdMapForTimesheet[entry.engagementId];
            if (engagementPlaceholder) {
                const engagementId = engagementRemarksToIdMap.get(engagementPlaceholder.remarks);
                if (engagementId) {
                    await client.query(
                        `INSERT INTO timesheet_entries (timesheet_id, engagement_id, hours, description) VALUES ($1, $2, $3, $4)`,
                        [newTimesheetId, engagementId, entry.hours, entry.description]
                    );
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
