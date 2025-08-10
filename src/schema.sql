
-- Drop existing tables in reverse order of dependency to avoid foreign key errors
DROP TABLE IF EXISTS "session";
DROP TABLE IF EXISTS "user";
DROP TABLE IF EXISTS "verification_token";
DROP TABLE IF EXISTS "account";
DROP TABLE IF EXISTS "activity_log";
DROP TABLE IF EXISTS "tasks";
DROP TABLE IF EXISTS "timesheet_entries";
DROP TABLE IF EXISTS "timesheets";
DROP TABLE IF EXISTS "pending_invoices";
DROP TABLE IF EXISTS "invoice_line_items";
DROP TABLE IF EXISTS "invoices";
DROP TABLE IF EXISTS "recurring_engagements";
DROP TABLE IF EXISTS "todos";
DROP TABLE IF EXISTS "engagements";
DROP TABLE IF EXISTS "clients";
DROP TABLE IF EXISTS "employees";
DROP TABLE IF EXISTS "firms";
DROP TABLE IF EXISTS "departments";
DROP TABLE IF EXISTS "engagement_types";
DROP TABLE IF EXISTS "client_categories";
DROP TABLE IF EXISTS "countries";
DROP TABLE IF EXISTS "permissions";
DROP TABLE IF EXISTS "tax_rates";
DROP TABLE IF EXISTS "hsn_sac_codes";
DROP TABLE IF EXISTS "sales_items";
DROP TABLE IF EXISTS "engagement_notes";
DROP TABLE IF EXISTS "chat_messages";
DROP TABLE IF EXISTS "chat_threads";
DROP TABLE IF EXISTS "calendar_events";
DROP TABLE IF EXISTS "leave_requests";

-- Firms Table
CREATE TABLE firms (
    id TEXT PRIMARY KEY DEFAULT 'firm_' || substr(md5(random()::text), 0, 25),
    name TEXT NOT NULL,
    pan TEXT,
    gstn TEXT,
    "pfCode" TEXT,
    "esiCode" TEXT,
    website TEXT,
    email TEXT,
    "contactNumber" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfscCode" TEXT,
    "billingAddressLine1" TEXT,
    "billingAddressLine2" TEXT,
    "billingAddressLine3" TEXT,
    country TEXT,
    state TEXT
);

-- Departments Table
CREATE TABLE departments (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    "order" INTEGER
);

-- Employees Table
CREATE TABLE employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    designation TEXT,
    avatar TEXT,
    role TEXT[],
    "managerId" TEXT,
    linkedin TEXT,
    "emergencyContact" TEXT,
    "bloodGroup" TEXT,
    "leaveAllowance" INTEGER,
    "leavesTaken" INTEGER,
    "monthlySalary" NUMERIC,
    "firmId" TEXT REFERENCES firms(id)
);

-- Clients Table
CREATE TABLE clients (
    id TEXT PRIMARY KEY DEFAULT 'client_' || substr(md5(random()::text), 0, 23),
    name TEXT NOT NULL,
    "mailId" TEXT,
    "mobileNumber" TEXT,
    category TEXT,
    "partnerId" TEXT REFERENCES employees(id),
    "firmId" TEXT REFERENCES firms(id),
    "phoneNumber" TEXT,
    "dateOfBirth" TIMESTAMPTZ,
    "linkedClientIds" TEXT[],
    pan TEXT,
    gstin TEXT,
    "billingAddressLine1" TEXT,
    "billingAddressLine2" TEXT,
    "billingAddressLine3" TEXT,
    pincode TEXT,
    state TEXT,
    country TEXT,
    "contactPerson" TEXT,
    "contactPersonDesignation" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "lastUpdated" TIMESTAMPTZ DEFAULT NOW()
);

-- Engagement Types Table
CREATE TABLE engagement_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    "subTaskTitles" TEXT[],
    "applicableCategories" TEXT[],
    recurrence TEXT
);

-- Engagements Table
CREATE TABLE engagements (
    id TEXT PRIMARY KEY DEFAULT 'eng_' || substr(md5(random()::text), 0, 25),
    "clientId" TEXT REFERENCES clients(id) ON DELETE CASCADE,
    remarks TEXT NOT NULL,
    type TEXT REFERENCES engagement_types(id),
    "assignedTo" TEXT[],
    "reportedTo" TEXT,
    "dueDate" TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL,
    "billStatus" TEXT,
    "billSubmissionDate" TIMESTAMPTZ,
    fees NUMERIC,
    notes TEXT,
    "recurringEngagementId" TEXT,
    "salesItemId" TEXT
);

-- Tasks Table
CREATE TABLE tasks (
    id TEXT PRIMARY KEY DEFAULT 'task_' || substr(md5(random()::text), 0, 25),
    "engagementId" TEXT REFERENCES engagements(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    "order" INTEGER,
    "assignedTo" TEXT
);

-- Timesheets Table
CREATE TABLE timesheets (
    id TEXT PRIMARY KEY,
    "userId" TEXT REFERENCES employees(id),
    "userName" TEXT,
    "isPartner" BOOLEAN,
    "weekStartDate" TIMESTAMPTZ,
    "totalHours" NUMERIC
);

-- Timesheet Entries Table
CREATE TABLE timesheet_entries (
    id SERIAL PRIMARY KEY,
    timesheet_id TEXT REFERENCES timesheets(id) ON DELETE CASCADE,
    engagement_id TEXT REFERENCES engagements(id) ON DELETE CASCADE,
    hours NUMERIC NOT NULL,
    description TEXT
);

-- Countries Table
CREATE TABLE countries (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL
);

-- Client Categories Table
CREATE TABLE client_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

-- Permissions Table
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    feature TEXT NOT NULL,
    departments TEXT[]
);

-- TaxRates Table
CREATE TABLE tax_rates (
    id TEXT PRIMARY KEY DEFAULT 'taxrate_' || substr(md5(random()::text), 0, 21),
    name TEXT NOT NULL,
    rate NUMERIC NOT NULL,
    "isDefault" BOOLEAN DEFAULT FALSE
);

-- HSN/SAC Codes Table
CREATE TABLE hsn_sac_codes (
    id TEXT PRIMARY KEY DEFAULT 'hsn_' || substr(md5(random()::text), 0, 26),
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL, -- 'HSN' or 'SAC'
    "isDefault" BOOLEAN DEFAULT FALSE
);

-- Sales Items Table
CREATE TABLE sales_items (
    id TEXT PRIMARY KEY DEFAULT 'salesitem_' || substr(md5(random()::text), 0, 20),
    name TEXT NOT NULL,
    description TEXT,
    "standardPrice" NUMERIC NOT NULL,
    "defaultTaxRateId" TEXT,
    "defaultSacId" TEXT,
    "associatedEngagementTypeId" TEXT
);

-- Invoices Table
CREATE TABLE invoices (
    id TEXT PRIMARY KEY DEFAULT 'inv_' || substr(md5(random()::text), 0, 26),
    "invoiceNumber" TEXT NOT NULL,
    "clientId" TEXT REFERENCES clients(id),
    "clientName" TEXT,
    "engagementId" TEXT REFERENCES engagements(id),
    "firmId" TEXT REFERENCES firms(id),
    "issueDate" TIMESTAMPTZ NOT NULL,
    "dueDate" TIMESTAMPTZ,
    "subTotal" NUMERIC,
    "totalDiscount" NUMERIC,
    "taxableAmount" NUMERIC,
    "totalTax" NUMERIC,
    "totalAmount" NUMERIC,
    status TEXT,
    "tallyClientLedgerName" TEXT,
    "tallySalesLedger" TEXT,
    "tallyCGSTLedger" TEXT,
    "tallySGSTLedger" TEXT,
    "tallyIGSTLedger" TEXT,
    narration TEXT
);

-- Invoice Line Items Table
CREATE TABLE invoice_line_items (
    id SERIAL PRIMARY KEY,
    "invoiceId" TEXT REFERENCES invoices(id) ON DELETE CASCADE,
    "salesItemId" TEXT,
    description TEXT,
    quantity NUMERIC,
    rate NUMERIC,
    discount NUMERIC,
    "taxRateId" TEXT,
    "taxAmount" NUMERIC,
    "sacCodeId" TEXT,
    total NUMERIC,
    "tallyServiceLedgerName" TEXT
);

-- Todos Table
CREATE TABLE todos (
    id TEXT PRIMARY KEY,
    type TEXT,
    text TEXT,
    "createdBy" TEXT,
    "assignedTo" TEXT[],
    "relatedEntity" JSONB,
    "isCompleted" BOOLEAN,
    "createdAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "completedBy" TEXT
);

-- Recurring Engagements Table
CREATE TABLE recurring_engagements (
    id TEXT PRIMARY KEY,
    "clientId" TEXT,
    "engagementTypeId" TEXT,
    fees NUMERIC,
    "isActive" BOOLEAN,
    "assignedTo" TEXT[],
    "reportedTo" TEXT,
    "lastGeneratedDate" TIMESTAMPTZ
);

-- Pending Invoices Table
CREATE TABLE pending_invoices (
    id TEXT PRIMARY KEY,
    "engagementId" TEXT,
    "clientId" TEXT,
    "assignedTo" TEXT[],
    "reportedTo" TEXT,
    "partnerId" TEXT
);

-- Communications Table
CREATE TABLE communications (
    id TEXT PRIMARY KEY,
    "from" TEXT,
    subject TEXT,
    body TEXT,
    "receivedAt" TIMESTAMPTZ,
    "clientId" TEXT,
    "clientName" TEXT,
    summary TEXT,
    category TEXT,
    "actionItems" TEXT[],
    "visibleTo" TEXT[]
);

-- Leave Requests Table
CREATE TABLE leave_requests (
    id TEXT PRIMARY KEY,
    "employeeId" TEXT,
    "employeeName" TEXT,
    "startDate" TIMESTAMPTZ,
    "endDate" TIMESTAMPTZ,
    reason TEXT,
    status TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMPTZ
);

-- Calendar Events Table
CREATE TABLE calendar_events (
    id TEXT PRIMARY KEY,
    title TEXT,
    start TIMESTAMPTZ,
    "end" TIMESTAMPTZ,
    "allDay" BOOLEAN,
    "createdBy" TEXT,
    description TEXT,
    attendees TEXT[],
    location TEXT,
    "engagementId" TEXT,
    timezone TEXT
);

-- Activity Log Table
CREATE TABLE activity_log (
    id SERIAL PRIMARY KEY,
    "engagementId" TEXT,
    "clientId" TEXT,
    type TEXT,
    "timestamp" TIMESTAMPTZ,
    "userId" TEXT,
    "userName" TEXT,
    details JSONB
);

-- Chat Threads and Messages (Optional, for future use)
CREATE TABLE chat_threads (
    id TEXT PRIMARY KEY,
    participants TEXT[],
    "lastMessage" JSONB,
    "updatedAt" TIMESTAMPTZ
);

CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    "threadId" TEXT REFERENCES chat_threads(id) ON DELETE CASCADE,
    "senderId" TEXT,
    text TEXT,
    timestamp TIMESTAMPTZ
);

-- Engagement Notes
CREATE TABLE engagement_notes (
    id TEXT PRIMARY KEY,
    "engagementId" TEXT REFERENCES engagements(id) ON DELETE CASCADE,
    "clientId" TEXT,
    text TEXT,
    category TEXT,
    "financialYear" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ,
    mentions TEXT[]
);
