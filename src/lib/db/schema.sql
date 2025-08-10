
-- Drop existing tables in reverse order of dependency to avoid foreign key conflicts
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


-- Create Firms Table
CREATE TABLE "firms" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "pan" text NOT NULL,
  "gstn" text,
  "pfCode" text,
  "esiCode" text,
  "website" text,
  "email" text,
  "contactNumber" text,
  "bankAccountName" text,
  "bankAccountNumber" text,
  "bankIfscCode" text,
  "billingAddressLine1" text,
  "billingAddressLine2" text,
  "billingAddressLine3" text,
  "country" text,
  "state" text
);

-- Create Departments Table
CREATE TABLE "departments" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "order" integer NOT NULL
);

-- Create Employees Table
CREATE TABLE "employees" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "designation" text,
  "avatar" text,
  "role" text[], -- Storing roles as an array of strings
  "managerId" text, -- Can be nullable if an employee has no manager
  "linkedin" text,
  "emergencyContact" text,
  "bloodGroup" text,
  "leaveAllowance" integer,
  "leavesTaken" integer,
  "monthlySalary" numeric(12, 2)
);


-- Create Clients Table
CREATE TABLE "clients" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "mailId" text,
  "mobileNumber" text,
  "category" text,
  "partnerId" text REFERENCES "employees"("id") ON DELETE SET NULL,
  "firmId" text REFERENCES "firms"("id") ON DELETE CASCADE,
  "phoneNumber" text,
  "dateOfBirth" timestamptz,
  "linkedClientIds" text[],
  "pan" text,
  "gstin" text,
  "billingAddressLine1" text,
  "billingAddressLine2" text,
  "billingAddressLine3" text,
  "pincode" text,
  "state" text,
  "country" text,
  "contactPerson" text,
  "contactPersonDesignation" text,
  "createdAt" timestamptz DEFAULT now(),
  "lastUpdated" timestamptz DEFAULT now()
);

-- Create Engagement Types Table
CREATE TABLE "engagement_types" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "description" text,
  "subTaskTitles" text[],
  "applicableCategories" text[],
  "recurrence" text -- Can be 'Monthly', 'Quarterly', 'Yearly'
);

-- Create Engagements Table
CREATE TABLE "engagements" (
  "id" text PRIMARY KEY,
  "clientId" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "remarks" text,
  "type" text REFERENCES "engagement_types"("id"),
  "assignedTo" text[],
  "reportedTo" text,
  "dueDate" timestamptz,
  "status" text,
  "billStatus" text,
  "billSubmissionDate" timestamptz,
  "fees" numeric(12, 2),
  "notes" text,
  "recurringEngagementId" text
);

-- Create Tasks Table
CREATE TABLE "tasks" (
  "id" text PRIMARY KEY,
  "engagementId" text NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "title" text,
  "status" text,
  "order" integer,
  "assignedTo" text
);

-- Create Timesheets Table
CREATE TABLE "timesheets" (
  "id" text PRIMARY KEY, -- Composite key: userId_weekStartDate
  "userId" text NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "userName" text,
  "isPartner" boolean,
  "weekStartDate" timestamptz NOT NULL,
  "totalHours" numeric(5, 2)
);

-- Create Timesheet Entries Table
CREATE TABLE "timesheet_entries" (
  "id" bigserial PRIMARY KEY,
  "timesheet_id" text NOT NULL REFERENCES "timesheets"("id") ON DELETE CASCADE,
  "engagement_id" text REFERENCES "engagements"("id") ON DELETE SET NULL,
  "hours" numeric(4, 2) NOT NULL,
  "description" text
);


-- Create Activity Log Table
CREATE TABLE "activity_log" (
    "id" bigserial PRIMARY KEY,
    "engagement_id" text REFERENCES "engagements"("id") ON DELETE CASCADE,
    "client_id" text REFERENCES "clients"("id") ON DELETE CASCADE,
    "type" text,
    "user_id" text,
    "user_name" text,
    "details" jsonb,
    "timestamp" timestamptz DEFAULT now()
);

-- Add indexes for frequently queried columns
CREATE INDEX idx_engagements_client_id ON "engagements"("clientId");
CREATE INDEX idx_engagements_status ON "engagements"("status");
CREATE INDEX idx_tasks_engagement_id ON "tasks"("engagementId");
CREATE INDEX idx_activity_log_engagement_id ON "activity_log"("engagement_id");
CREATE INDEX idx_clients_partner_id ON "clients"("partnerId");
