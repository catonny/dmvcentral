-- Drop tables in reverse order of creation to handle dependencies
DROP TABLE IF EXISTS "activity_log" CASCADE;
DROP TABLE IF EXISTS "tasks" CASCADE;
DROP TABLE IF EXISTS "timesheet_entries" CASCADE;
DROP TABLE IF EXISTS "timesheets" CASCADE;
DROP TABLE IF EXISTS "pending_invoices" CASCADE;
DROP TABLE IF EXISTS "invoice_line_items" CASCADE;
DROP TABLE IF EXISTS "invoices" CASCADE;
DROP TABLE IF EXISTS "recurring_engagements" CASCADE;
DROP TABLE IF EXISTS "todos" CASCADE;
DROP TABLE IF EXISTS "engagements" CASCADE;
DROP TABLE IF EXISTS "clients" CASCADE;
DROP TABLE IF EXISTS "employees" CASCADE;
DROP TABLE IF EXISTS "firms" CASCADE;
DROP TABLE IF EXISTS "departments" CASCADE;
DROP TABLE IF EXISTS "engagement_types" CASCADE;
DROP TABLE IF EXISTS "client_categories" CASCADE;
DROP TABLE IF EXISTS "countries" CASCADE;
DROP TABLE IF EXISTS "permissions" CASCADE;
DROP TABLE IF EXISTS "tax_rates" CASCADE;
DROP TABLE IF EXISTS "hsn_sac_codes" CASCADE;
DROP TABLE IF EXISTS "sales_items" CASCADE;
DROP TABLE IF EXISTS "engagement_notes" CASCADE;
DROP TABLE IF EXISTS "chat_messages" CASCADE;
DROP TABLE IF EXISTS "chat_threads" CASCADE;
DROP TABLE IF EXISTS "calendar_events" CASCADE;
DROP TABLE IF EXISTS "leave_requests" CASCADE;


-- Create Firms Table
CREATE TABLE firms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    pan VARCHAR(10) UNIQUE,
    gstn VARCHAR(15) UNIQUE,
    "pfCode" VARCHAR(255),
    "esiCode" VARCHAR(255),
    website VARCHAR(255),
    email VARCHAR(255),
    "contactNumber" VARCHAR(255),
    "bankAccountName" VARCHAR(255),
    "bankAccountNumber" VARCHAR(255),
    "bankIfscCode" VARCHAR(255),
    "billingAddressLine1" TEXT,
    "billingAddressLine2" TEXT,
    "billingAddressLine3" TEXT,
    country VARCHAR(255),
    state VARCHAR(255)
);

-- Create Departments Table
CREATE TABLE departments (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    "order" INTEGER
);

-- Create Employees Table
CREATE TABLE employees (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    designation VARCHAR(255),
    avatar TEXT,
    role VARCHAR(255)[],
    "leaveAllowance" INTEGER,
    "leavesTaken" INTEGER,
    "managerId" VARCHAR(255) REFERENCES employees(id)
);

-- Create Countries Table
CREATE TABLE countries (
    code VARCHAR(2) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

-- Create Client Categories Table
CREATE TABLE client_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- Create Engagement Types Table
CREATE TABLE engagement_types (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    "subTaskTitles" TEXT[],
    recurrence VARCHAR(50),
    "applicableCategories" VARCHAR(255)[]
);

-- Create Tax Rates Table
CREATE TABLE tax_rates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rate NUMERIC(5, 2) NOT NULL,
    "isDefault" BOOLEAN DEFAULT false
);

-- Create HSN/SAC Codes Table
CREATE TABLE hsn_sac_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    type VARCHAR(10) NOT NULL, -- HSN or SAC
    "isDefault" BOOLEAN DEFAULT false
);

-- Create Sales Items Table
CREATE TABLE sales_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    "standardPrice" NUMERIC(12, 2) NOT NULL,
    "defaultTaxRateId" INTEGER REFERENCES tax_rates(id),
    "defaultSacId" INTEGER REFERENCES hsn_sac_codes(id),
    "associatedEngagementTypeId" VARCHAR(255) REFERENCES engagement_types(id)
);

-- Create Clients Table
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    "mailId" VARCHAR(255),
    "mobileNumber" VARCHAR(20),
    category VARCHAR(255),
    "partnerId" VARCHAR(255) REFERENCES employees(id),
    "firmId" INTEGER REFERENCES firms(id),
    "phoneNumber" VARCHAR(20),
    "dateOfBirth" TIMESTAMPTZ,
    "linkedClientIds" INTEGER[],
    pan VARCHAR(10),
    gstin VARCHAR(15),
    "billingAddressLine1" TEXT,
    "billingAddressLine2" TEXT,
    "billingAddressLine3" TEXT,
    pincode VARCHAR(10),
    state VARCHAR(255),
    country VARCHAR(255),
    "contactPerson" VARCHAR(255),
    "contactPersonDesignation" VARCHAR(255),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "lastUpdated" TIMESTAMPTZ
);

-- Create Engagements Table
CREATE TABLE engagements (
    id SERIAL PRIMARY KEY,
    "clientId" INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    remarks TEXT,
    type VARCHAR(255) REFERENCES engagement_types(id),
    "assignedTo" VARCHAR(255)[],
    "reportedTo" VARCHAR(255) REFERENCES employees(id),
    "dueDate" TIMESTAMPTZ,
    status VARCHAR(50),
    "billStatus" VARCHAR(50),
    "billSubmissionDate" TIMESTAMPTZ,
    fees NUMERIC(12, 2),
    "recurringEngagementId" INTEGER,
    "salesItemId" INTEGER REFERENCES sales_items(id)
);

-- Create Tasks Table
CREATE TABLE tasks (
    id SERIAL PRIMARY KEY,
    "engagementId" INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50),
    "order" INTEGER,
    "assignedTo" VARCHAR(255) REFERENCES employees(id)
);

-- Create Timesheets Table
CREATE TABLE timesheets (
    id VARCHAR(255) PRIMARY KEY, -- Composite key: userId_weekStartDate
    "userId" VARCHAR(255) REFERENCES employees(id),
    "userName" VARCHAR(255),
    "isPartner" BOOLEAN,
    "weekStartDate" TIMESTAMPTZ,
    "totalHours" NUMERIC(5, 2)
);

-- Create Timesheet Entries Table
CREATE TABLE timesheet_entries (
    id SERIAL PRIMARY KEY,
    "timesheetId" VARCHAR(255) REFERENCES timesheets(id) ON DELETE CASCADE,
    "engagementId" INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
    hours NUMERIC(5, 2) NOT NULL,
    description TEXT
);

-- Create Pending Invoices Table (for billing workflow)
CREATE TABLE pending_invoices (
    id SERIAL PRIMARY KEY,
    "engagementId" INTEGER REFERENCES engagements(id) ON DELETE CASCADE,
    "clientId" INTEGER REFERENCES clients(id),
    "assignedTo" VARCHAR(255)[],
    "reportedTo" VARCHAR(255),
    "partnerId" VARCHAR(255)
);

-- Create Invoices Table
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    "invoiceNumber" VARCHAR(255) NOT NULL UNIQUE,
    "clientId" INTEGER REFERENCES clients(id),
    "clientName" VARCHAR(255),
    "engagementId" INTEGER REFERENCES engagements(id),
    "firmId" INTEGER REFERENCES firms(id),
    "issueDate" TIMESTAMPTZ,
    "dueDate" TIMESTAMPTZ,
    "subTotal" NUMERIC(12, 2),
    "totalDiscount" NUMERIC(12, 2),
    "taxableAmount" NUMERIC(12, 2),
    "totalTax" NUMERIC(12, 2),
    "totalAmount" NUMERIC(12, 2),
    status VARCHAR(50),
    "tallyClientLedgerName" VARCHAR(255),
    "tallySalesLedger" VARCHAR(255),
    "tallyCGSTLedger" VARCHAR(255),
    "tallySGSTLedger" VARCHAR(255),
    "tallyIGSTLedger" VARCHAR(255),
    narration TEXT
);

-- Create Invoice Line Items Table
CREATE TABLE invoice_line_items (
    id SERIAL PRIMARY KEY,
    "invoiceId" INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    "salesItemId" INTEGER REFERENCES sales_items(id),
    description TEXT,
    quantity INTEGER,
    rate NUMERIC(12, 2),
    discount NUMERIC(12, 2),
    "taxRateId" INTEGER REFERENCES tax_rates(id),
    "taxAmount" NUMERIC(12, 2),
    "sacCodeId" INTEGER REFERENCES hsn_sac_codes(id),
    total NUMERIC(12, 2),
    "tallyServiceLedgerName" VARCHAR(255)
);

-- Create Recurring Engagements Table
CREATE TABLE recurring_engagements (
    id SERIAL PRIMARY KEY,
    "clientId" INTEGER REFERENCES clients(id),
    "engagementTypeId" VARCHAR(255) REFERENCES engagement_types(id),
    fees NUMERIC(12, 2),
    "isActive" BOOLEAN,
    "assignedTo" VARCHAR(255)[],
    "reportedTo" VARCHAR(255),
    "lastGeneratedDate" TIMESTAMPTZ
);

-- Create To-Dos Table
CREATE TABLE todos (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50),
    text TEXT,
    "createdBy" VARCHAR(255),
    "assignedTo" VARCHAR(255)[],
    "relatedEntity" JSONB,
    "isCompleted" BOOLEAN,
    "createdAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "completedBy" VARCHAR(255)
);

-- Create Activity Log Table
CREATE TABLE activity_log (
    id SERIAL PRIMARY KEY,
    "engagementId" INTEGER REFERENCES engagements(id),
    "clientId" INTEGER,
    type VARCHAR(50),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    "userId" VARCHAR(255),
    "userName" VARCHAR(255),
    details JSONB
);

-- Create Permissions Table
CREATE TABLE permissions (
    feature VARCHAR(255) PRIMARY KEY,
    departments VARCHAR(255)[]
);

-- Create Engagement Notes Table
CREATE TABLE engagement_notes (
    id SERIAL PRIMARY KEY,
    "engagementId" INTEGER REFERENCES engagements(id),
    "clientId" INTEGER,
    text TEXT,
    category VARCHAR(50),
    "financialYear" VARCHAR(10),
    "createdBy" VARCHAR(255),
    "createdAt" TIMESTAMPTZ,
    mentions VARCHAR(255)[]
);

-- Create Calendar Events Table
CREATE TABLE calendar_events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    start TIMESTAMPTZ,
    "end" TIMESTAMPTZ, -- 'end' is a keyword, so quoted
    "allDay" BOOLEAN,
    "createdBy" VARCHAR(255),
    description TEXT,
    attendees VARCHAR(255)[],
    location TEXT,
    "engagementId" INTEGER,
    timezone VARCHAR(255)
);

-- Create Leave Requests Table
CREATE TABLE leave_requests (
    id SERIAL PRIMARY KEY,
    "employeeId" VARCHAR(255) REFERENCES employees(id),
    "employeeName" VARCHAR(255),
    "startDate" TIMESTAMPTZ,
    "endDate" TIMESTAMPTZ,
    reason TEXT,
    status VARCHAR(50),
    "approvedBy" VARCHAR(255),
    "createdAt" TIMESTAMPTZ
);

-- Chat tables (basic structure)
CREATE TABLE chat_threads (
    id SERIAL PRIMARY KEY,
    participants VARCHAR(255)[],
    "lastMessage" JSONB,
    "participantDetails" JSONB,
    "updatedAt" TIMESTAMPTZ
);

CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    "threadId" INTEGER REFERENCES chat_threads(id),
    "senderId" VARCHAR(255),
    text TEXT,
    timestamp TIMESTAMPTZ
);
