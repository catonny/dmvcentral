-- Drop tables in reverse order of dependency to avoid foreign key constraints errors
DROP TABLE IF EXISTS "activity_log" CASCADE;
DROP TABLE IF EXISTS "timesheet_entries" CASCADE;
DROP TABLE IF EXISTS "timesheets" CASCADE;
DROP TABLE IF EXISTS "tasks" CASCADE;
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

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables

CREATE TABLE "firms" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "pan" text,
  "gstn" text,
  "pf_code" text,
  "esi_code" text,
  "website" text,
  "email" text,
  "contact_number" text,
  "bank_account_name" text,
  "bank_account_number" text,
  "bank_ifsc_code" text,
  "billing_address_line1" text,
  "billing_address_line2" text,
  "billing_address_line3" text,
  "country" text,
  "state" text
);

CREATE TABLE "departments" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" text NOT NULL UNIQUE,
  "order" integer NOT NULL
);

CREATE TABLE "employees" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "designation" text,
  "avatar" text,
  "role" text[],
  "manager_id" text REFERENCES "employees"("id"),
  "linkedin" text,
  "emergency_contact" text,
  "blood_group" text,
  "leave_allowance" integer,
  "leaves_taken" integer,
  "monthly_salary" integer
);

CREATE TABLE "clients" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" text NOT NULL,
  "mail_id" text NOT NULL,
  "mobile_number" text NOT NULL,
  "category" text,
  "partner_id" text REFERENCES "employees"("id"),
  "firm_id" text REFERENCES "firms"("id"),
  "phone_number" text,
  "date_of_birth" timestamptz,
  "linked_client_ids" text[],
  "pan" text,
  "gstin" text,
  "billing_address_line1" text,
  "billing_address_line2" text,
  "billing_address_line3" text,
  "pincode" text,
  "state" text,
  "country" text,
  "contact_person" text,
  "contact_person_designation" text,
  "created_at" timestamptz NOT NULL,
  "last_updated" timestamptz NOT NULL
);

CREATE TABLE "engagement_types" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL UNIQUE,
  "description" text,
  "sub_task_titles" text[],
  "applicable_categories" text[],
  "recurrence" text
);

CREATE TABLE "engagements" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "client_id" text NOT NULL REFERENCES "clients"("id"),
  "remarks" text,
  "type" text NOT NULL REFERENCES "engagement_types"("id"),
  "assigned_to" text[],
  "reported_to" text,
  "due_date" timestamptz NOT NULL,
  "status" text NOT NULL,
  "bill_status" text,
  "bill_submission_date" timestamptz,
  "fees" numeric,
  "recurring_engagement_id" text,
  "sales_item_id" text
);

CREATE TABLE "tasks" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "engagement_id" text NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "status" text NOT NULL,
  "order" integer NOT NULL,
  "assigned_to" text
);

CREATE TABLE "timesheets" (
    "id" TEXT PRIMARY KEY,
    "user_id" TEXT NOT NULL REFERENCES "employees"("id"),
    "user_name" TEXT NOT NULL,
    "is_partner" BOOLEAN,
    "week_start_date" TIMESTAMPTZ NOT NULL,
    "total_hours" NUMERIC NOT NULL
);

CREATE TABLE "timesheet_entries" (
    "id" SERIAL PRIMARY KEY,
    "timesheet_id" TEXT NOT NULL REFERENCES "timesheets"("id") ON DELETE CASCADE,
    "engagement_id" TEXT NOT NULL REFERENCES "engagements"("id") ON DELETE CASCADE,
    "hours" NUMERIC NOT NULL,
    "description" TEXT
);

CREATE TABLE "activity_log" (
  "id" SERIAL PRIMARY KEY,
  "engagement_id" text REFERENCES "engagements"("id") ON DELETE SET NULL,
  "client_id" text REFERENCES "clients"("id") ON DELETE CASCADE,
  "type" text,
  "timestamp" timestamptz,
  "user_id" text REFERENCES "employees"("id") ON DELETE SET NULL,
  "user_name" text,
  "details" jsonb
);

CREATE TABLE "todos" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "type" text,
  "text" text,
  "created_by" text,
  "assigned_to" text[],
  "related_entity" jsonb,
  "is_completed" boolean,
  "created_at" timestamptz,
  "completed_at" timestamptz,
  "completed_by" text
);

CREATE TABLE "pending_invoices" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "engagement_id" text REFERENCES "engagements"("id") ON DELETE CASCADE,
  "client_id" text REFERENCES "clients"("id") ON DELETE CASCADE,
  "assigned_to" text[],
  "reported_to" text,
  "partner_id" text
);

CREATE TABLE "tax_rates" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" text,
  "rate" numeric,
  "is_default" boolean
);

CREATE TABLE "hsn_sac_codes" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "code" text,
  "description" text,
  "type" text,
  "is_default" boolean
);

CREATE TABLE "sales_items" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" text,
  "description" text,
  "standard_price" numeric,
  "default_tax_rate_id" text REFERENCES "tax_rates"("id"),
  "default_sac_id" text REFERENCES "hsn_sac_codes"("id"),
  "associated_engagement_type_id" text REFERENCES "engagement_types"("id")
);

CREATE TABLE "invoices" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "invoice_number" text,
  "client_id" text REFERENCES "clients"("id"),
  "client_name" text,
  "engagement_id" text REFERENCES "engagements"("id") ON DELETE SET NULL,
  "firm_id" text REFERENCES "firms"("id"),
  "issue_date" timestamptz,
  "due_date" timestamptz,
  "sub_total" numeric,
  "total_discount" numeric,
  "taxable_amount" numeric,
  "total_tax" numeric,
  "total_amount" numeric,
  "status" text,
  "tally_client_ledger_name" text,
  "tally_sales_ledger" text,
  "tally_cgst_ledger" text,
  "tally_sgst_ledger" text,
  "tally_igst_ledger" text,
  "narration" text,
  "line_items" jsonb
);

CREATE TABLE "invoice_line_items" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "invoice_id" text REFERENCES "invoices"("id") ON DELETE CASCADE,
  "sales_item_id" text REFERENCES "sales_items"("id"),
  "description" text,
  "quantity" integer,
  "rate" numeric,
  "discount" numeric,
  "tax_rate_id" text REFERENCES "tax_rates"("id"),
  "tax_amount" numeric,
  "sac_code_id" text,
  "total" numeric,
  "tally_service_ledger_name" text
);


CREATE TABLE "recurring_engagements" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "client_id" text REFERENCES "clients"("id"),
  "engagement_type_id" text REFERENCES "engagement_types"("id"),
  "fees" numeric,
  "is_active" boolean,
  "assigned_to" text[],
  "reported_to" text,
  "last_generated_date" timestamptz
);

CREATE TABLE "engagement_notes" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "engagement_id" text REFERENCES "engagements"("id") ON DELETE CASCADE,
  "client_id" text REFERENCES "clients"("id") ON DELETE CASCADE,
  "text" text,
  "category" text,
  "financial_year" text,
  "created_by" text,
  "created_at" timestamptz,
  "mentions" text[]
);

CREATE TABLE "calendar_events" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "title" text,
  "start" timestamptz,
  "end" timestamptz,
  "all_day" boolean,
  "created_by" text,
  "description" text,
  "attendees" text[],
  "location" text,
  "engagement_id" text REFERENCES "engagements"("id") ON DELETE SET NULL,
  "timezone" text
);

CREATE TABLE "leave_requests" (
  "id" text PRIMARY KEY DEFAULT uuid_generate_v4(),
  "employee_id" text REFERENCES "employees"("id"),
  "employee_name" text,
  "start_date" timestamptz,
  "end_date" timestamptz,
  "reason" text,
  "status" text,
  "approved_by" text,
  "created_at" timestamptz
);

-- Permissions and other non-relational data
CREATE TABLE "permissions" (
    "feature" TEXT PRIMARY KEY,
    "departments" TEXT[]
);

CREATE TABLE "client_categories" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT UNIQUE
);

CREATE TABLE "countries" (
    "name" TEXT PRIMARY KEY,
    "code" TEXT
);

CREATE TABLE "chat_threads" (
    "id" TEXT PRIMARY KEY,
    "participants" TEXT[],
    "last_message" JSONB,
    "participant_details" JSONB,
    "updated_at" TIMESTAMPTZ
);

CREATE TABLE "chat_messages" (
    "id" TEXT PRIMARY KEY,
    "thread_id" TEXT REFERENCES "chat_threads"("id") ON DELETE CASCADE,
    "sender_id" TEXT,
    "text" TEXT,
    "timestamp" TIMESTAMPTZ
);
