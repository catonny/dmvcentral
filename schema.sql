-- Enable the "uuid-ossp" extension if it's not already enabled.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables in reverse order of dependency to avoid foreign key constraints issues.
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

-- Create tables in order of dependency.

CREATE TABLE "firms" (
  "id" VARCHAR(255) PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "pan" VARCHAR(255) NOT NULL UNIQUE,
  "gstn" VARCHAR(255),
  "pf_code" VARCHAR(255),
  "esi_code" VARCHAR(255),
  "website" VARCHAR(255),
  "email" VARCHAR(255),
  "contact_number" VARCHAR(255),
  "bank_account_name" VARCHAR(255),
  "bank_account_number" VARCHAR(255),
  "bank_ifsc_code" VARCHAR(255),
  "billing_address_line1" VARCHAR(255),
  "billing_address_line2" VARCHAR(255),
  "billing_address_line3" VARCHAR(255),
  "country" VARCHAR(255),
  "state" VARCHAR(255)
);

CREATE TABLE "departments" (
  "id" VARCHAR(255) PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL UNIQUE,
  "order" INTEGER NOT NULL
);

CREATE TABLE "employees" (
  "id" VARCHAR(255) PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "designation" VARCHAR(255),
  "avatar" VARCHAR(255),
  "role" TEXT[] NOT NULL,
  "manager_id" VARCHAR(255) REFERENCES "employees"("id"),
  "linkedin" VARCHAR(255),
  "emergency_contact" VARCHAR(255),
  "blood_group" VARCHAR(255),
  "leave_allowance" INTEGER,
  "leaves_taken" INTEGER,
  "monthly_salary" DECIMAL(10, 2)
);

CREATE TABLE "clients" (
  "id" VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" VARCHAR(255) NOT NULL,
  "mail_id" VARCHAR(255) NOT NULL,
  "mobile_number" VARCHAR(255) NOT NULL,
  "category" VARCHAR(255),
  "partner_id" VARCHAR(255) REFERENCES "employees"("id"),
  "firm_id" VARCHAR(255) REFERENCES "firms"("id"),
  "phone_number" VARCHAR(255),
  "date_of_birth" TIMESTAMPTZ,
  "linked_client_ids" TEXT[],
  "pan" VARCHAR(255) UNIQUE,
  "gstin" VARCHAR(255),
  "billing_address_line1" VARCHAR(255),
  "billing_address_line2" VARCHAR(255),
  "billing_address_line3" VARCHAR(255),
  "pincode" VARCHAR(255),
  "state" VARCHAR(255),
  "country" VARCHAR(255),
  "contact_person" VARCHAR(255),
  "contact_person_designation" VARCHAR(255),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "last_updated" TIMESTAMPTZ NOT NULL
);

CREATE TABLE "engagement_types" (
  "id" VARCHAR(255) PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "sub_task_titles" TEXT[],
  "recurrence" VARCHAR(255),
  "applicable_categories" TEXT[]
);

CREATE TABLE "engagements" (
  "id" VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
  "client_id" VARCHAR(255) NOT NULL REFERENCES "clients"("id"),
  "remarks" TEXT,
  "type" VARCHAR(255) NOT NULL REFERENCES "engagement_types"("id"),
  "assigned_to" TEXT[],
  "reported_to" VARCHAR(255),
  "due_date" TIMESTAMPTZ NOT NULL,
  "status" VARCHAR(255) NOT NULL,
  "bill_status" VARCHAR(255),
  "bill_submission_date" TIMESTAMPTZ,
  "fees" DECIMAL(12, 2),
  "recurring_engagement_id" VARCHAR(255),
  "sales_item_id" VARCHAR(255),
  "notes" TEXT
);

CREATE TABLE "tasks" (
  "id" VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
  "engagement_id" VARCHAR(255) NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "title" VARCHAR(255) NOT NULL,
  "status" VARCHAR(255) NOT NULL,
  "order" INTEGER NOT NULL,
  "assigned_to" VARCHAR(255) NOT NULL
);

CREATE TABLE "timesheets" (
    "id" VARCHAR(255) PRIMARY KEY,
    "user_id" VARCHAR(255) NOT NULL REFERENCES "employees"("id"),
    "user_name" VARCHAR(255),
    "is_partner" BOOLEAN,
    "week_start_date" TIMESTAMPTZ NOT NULL,
    "total_hours" DECIMAL(5, 2) NOT NULL
);

CREATE TABLE "timesheet_entries" (
  "id" SERIAL PRIMARY KEY,
  "timesheet_id" VARCHAR(255) NOT NULL,
  "engagement_id" VARCHAR(255) NOT NULL,
  "hours" NUMERIC(5, 2) NOT NULL,
  "description" TEXT,
  FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE CASCADE,
  FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE CASCADE
);


CREATE TABLE "activity_log" (
  "id" SERIAL PRIMARY KEY,
  "engagement_id" VARCHAR(255),
  "client_id" VARCHAR(255),
  "type" VARCHAR(255),
  "timestamp" TIMESTAMPTZ NOT NULL,
  "user_id" VARCHAR(255),
  "user_name" VARCHAR(255),
  "details" JSONB
);

CREATE TABLE "client_categories" (
    "id" VARCHAR(255) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE "countries" (
    "code" VARCHAR(10) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL
);

CREATE TABLE "engagement_notes" (
    "id" VARCHAR(255) PRIMARY KEY,
    "engagement_id" VARCHAR(255),
    "client_id" VARCHAR(255),
    "text" TEXT,
    "category" VARCHAR(255),
    "financial_year" VARCHAR(255),
    "created_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ,
    "mentions" TEXT[]
);

CREATE TABLE "hsn_sac_codes" (
    "id" VARCHAR(255) PRIMARY KEY,
    "code" VARCHAR(255),
    "description" TEXT,
    "type" VARCHAR(255),
    "is_default" BOOLEAN
);

CREATE TABLE "invoice_line_items" (
    "id" SERIAL PRIMARY KEY,
    "invoice_id" INTEGER,
    "sales_item_id" VARCHAR(255),
    "description" TEXT,
    "quantity" INTEGER,
    "rate" DECIMAL(10,2),
    "discount" DECIMAL(10,2),
    "tax_rate_id" VARCHAR(255),
    "tax_amount" DECIMAL(10,2),
    "sac_code_id" VARCHAR(255),
    "total" DECIMAL(10,2)
);

CREATE TABLE "invoices" (
    "id" SERIAL PRIMARY KEY,
    "invoice_number" VARCHAR(255),
    "client_id" VARCHAR(255),
    "client_name" VARCHAR(255),
    "engagement_id" VARCHAR(255),
    "firm_id" VARCHAR(255),
    "issue_date" TIMESTAMPTZ,
    "due_date" TIMESTAMPTZ,
    "sub_total" DECIMAL(10,2),
    "total_discount" DECIMAL(10,2),
    "taxable_amount" DECIMAL(10,2),
    "total_tax" DECIMAL(10,2),
    "total_amount" DECIMAL(10,2),
    "status" VARCHAR(255),
    "tally_client_ledger_name" VARCHAR(255),
    "tally_sales_ledger" VARCHAR(255),
    "tally_cgst_ledger" VARCHAR(255),
    "tally_sgst_ledger" VARCHAR(255),
    "tally_igst_ledger" VARCHAR(255),
    "narration" TEXT
);

CREATE TABLE "leave_requests" (
    "id" VARCHAR(255) PRIMARY KEY,
    "employee_id" VARCHAR(255),
    "employee_name" VARCHAR(255),
    "start_date" TIMESTAMPTZ,
    "end_date" TIMESTAMPTZ,
    "reason" TEXT,
    "status" VARCHAR(255),
    "approved_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ
);

CREATE TABLE "pending_invoices" (
    "id" VARCHAR(255) PRIMARY KEY,
    "engagement_id" VARCHAR(255),
    "client_id" VARCHAR(255),
    "assigned_to" TEXT[],
    "reported_to" VARCHAR(255),
    "partner_id" VARCHAR(255)
);

CREATE TABLE "permissions" (
    "feature" VARCHAR(255) PRIMARY KEY,
    "departments" TEXT[]
);

CREATE TABLE "recurring_engagements" (
    "id" VARCHAR(255) PRIMARY KEY,
    "client_id" VARCHAR(255),
    "engagement_type_id" VARCHAR(255),
    "fees" DECIMAL(10,2),
    "is_active" BOOLEAN,
    "assigned_to" TEXT[],
    "reported_to" VARCHAR(255),
    "last_generated_date" TIMESTAMPTZ
);

CREATE TABLE "sales_items" (
    "id" VARCHAR(255) PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "standard_price" DECIMAL(10,2),
    "default_tax_rate_id" VARCHAR(255),
    "default_sac_id" VARCHAR(255),
    "associated_engagement_type_id" VARCHAR(255)
);

CREATE TABLE "tax_rates" (
    "id" VARCHAR(255) PRIMARY KEY,
    "name" VARCHAR(255),
    "rate" DECIMAL(5,2),
    "is_default" BOOLEAN
);

CREATE TABLE "todos" (
    "id" VARCHAR(255) PRIMARY KEY,
    "type" VARCHAR(255),
    "text" TEXT,
    "created_by" VARCHAR(255),
    "assigned_to" TEXT[],
    "related_entity" JSONB,
    "is_completed" BOOLEAN,
    "created_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "completed_by" VARCHAR(255)
);

CREATE TABLE "chat_threads" (
  "id" VARCHAR(255) PRIMARY KEY,
  "participants" TEXT[],
  "last_message" JSONB,
  "participant_details" JSONB,
  "updated_at" TIMESTAMPTZ
);

CREATE TABLE "chat_messages" (
  "id" VARCHAR(255) PRIMARY KEY,
  "thread_id" VARCHAR(255) REFERENCES "chat_threads"("id") ON DELETE CASCADE,
  "sender_id" VARCHAR(255),
  "text" TEXT,
  "timestamp" TIMESTAMPTZ
);

CREATE TABLE "calendar_events" (
  "id" VARCHAR(255) PRIMARY KEY,
  "title" VARCHAR(255),
  "start" TIMESTAMPTZ,
  "end" TIMESTAMPTZ,
  "all_day" BOOLEAN,
  "created_by" VARCHAR(255),
  "description" TEXT,
  "attendees" TEXT[],
  "location" VARCHAR(255),
  "engagement_id" VARCHAR(255),
  "timezone" VARCHAR(255)
);
