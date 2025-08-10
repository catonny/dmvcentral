-- Enable pgcrypto extension for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop tables in reverse order of creation to handle dependencies
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

-- Create tables

CREATE TABLE "firms" (
  "id" VARCHAR(255) PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "pan" VARCHAR(255) NOT NULL,
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
  "name" VARCHAR(255) UNIQUE NOT NULL,
  "order" INTEGER NOT NULL
);

CREATE TABLE "employees" (
  "id" VARCHAR(255) PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "designation" VARCHAR(255),
  "avatar" TEXT,
  "role" TEXT[],
  "manager_id" VARCHAR(255),
  "linkedin" VARCHAR(255),
  "emergency_contact" VARCHAR(255),
  "blood_group" VARCHAR(255),
  "leave_allowance" INTEGER,
  "leaves_taken" INTEGER,
  "monthly_salary" NUMERIC(10, 2),
  FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL
);

CREATE TABLE "clients" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(255) NOT NULL,
  "mail_id" VARCHAR(255) NOT NULL,
  "mobile_number" VARCHAR(255) NOT NULL,
  "category" VARCHAR(255),
  "partner_id" VARCHAR(255),
  "firm_id" VARCHAR(255),
  "phone_number" VARCHAR(255),
  "date_of_birth" TIMESTAMPTZ,
  "linked_client_ids" TEXT[],
  "pan" VARCHAR(255),
  "gstin" VARCHAR(255),
  "billing_address_line1" VARCHAR(255),
  "billing_address_line2" VARCHAR(255),
  "billing_address_line3" VARCHAR(255),
  "pincode" VARCHAR(255),
  "state" VARCHAR(255),
  "country" VARCHAR(255),
  "contact_person" VARCHAR(255),
  "contact_person_designation" VARCHAR(255),
  "created_at" TIMESTAMPTZ,
  "last_updated" TIMESTAMPTZ,
  FOREIGN KEY ("partner_id") REFERENCES "employees"("id") ON DELETE SET NULL,
  FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE SET NULL
);

CREATE TABLE "engagement_types" (
  "id" VARCHAR(255) PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "sub_task_titles" TEXT[],
  "recurrence" VARCHAR(50),
  "applicable_categories" TEXT[]
);

CREATE TABLE "engagements" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" UUID,
  "remarks" TEXT,
  "type" VARCHAR(255),
  "assigned_to" TEXT[],
  "reported_to" VARCHAR(255),
  "due_date" TIMESTAMPTZ,
  "status" VARCHAR(255),
  "bill_status" VARCHAR(255),
  "bill_submission_date" TIMESTAMPTZ,
  "fees" NUMERIC(12, 2),
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE,
  FOREIGN KEY ("reported_to") REFERENCES "employees"("id") ON DELETE SET NULL
);

CREATE TABLE "tasks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "engagement_id" UUID,
  "title" VARCHAR(255) NOT NULL,
  "status" VARCHAR(50),
  "order" INTEGER,
  "assigned_to" VARCHAR(255),
  FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE CASCADE,
  FOREIGN KEY ("assigned_to") REFERENCES "employees"("id") ON DELETE SET NULL
);

CREATE TABLE "timesheets" (
  "id" VARCHAR(255) PRIMARY KEY,
  "user_id" VARCHAR(255) NOT NULL,
  "user_name" VARCHAR(255),
  "is_partner" BOOLEAN,
  "week_start_date" TIMESTAMPTZ,
  "total_hours" NUMERIC(5, 2),
  FOREIGN KEY ("user_id") REFERENCES "employees"("id") ON DELETE CASCADE
);

CREATE TABLE "timesheet_entries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "timesheet_id" VARCHAR(255),
  "engagement_id" UUID,
  "hours" NUMERIC(5, 2),
  "description" TEXT,
  FOREIGN KEY ("timesheet_id") REFERENCES "timesheets"("id") ON DELETE CASCADE,
  FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE CASCADE
);


CREATE TABLE "activity_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "engagement_id" UUID,
  "client_id" UUID,
  "type" VARCHAR(255),
  "user_id" VARCHAR(255),
  "user_name" VARCHAR(255),
  "details" JSONB,
  "timestamp" TIMESTAMPTZ,
  FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE CASCADE,
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE,
  FOREIGN KEY ("user_id") REFERENCES "employees"("id") ON DELETE SET NULL
);

-- Other tables from data model
CREATE TABLE "pending_invoices" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "engagement_id" UUID,
    "client_id" UUID,
    "assigned_to" TEXT[],
    "reported_to" VARCHAR(255),
    "partner_id" VARCHAR(255),
    FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE CASCADE
);

CREATE TABLE "invoices" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoice_number" VARCHAR(255) UNIQUE,
    "client_id" UUID,
    "client_name" VARCHAR(255),
    "engagement_id" UUID,
    "firm_id" VARCHAR(255),
    "issue_date" TIMESTAMPTZ,
    "due_date" TIMESTAMPTZ,
    "sub_total" NUMERIC(12, 2),
    "total_discount" NUMERIC(12, 2),
    "taxable_amount" NUMERIC(12, 2),
    "total_tax" NUMERIC(12, 2),
    "total_amount" NUMERIC(12, 2),
    "status" VARCHAR(50),
    "tally_client_ledger_name" VARCHAR(255),
    "tally_sales_ledger" VARCHAR(255),
    "tally_cgst_ledger" VARCHAR(255),
    "tally_sgst_ledger" VARCHAR(255),
    "tally_igst_ledger" VARCHAR(255),
    "narration" TEXT,
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE,
    FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE SET NULL,
    FOREIGN KEY ("firm_id") REFERENCES "firms"("id") ON DELETE SET NULL
);

CREATE TABLE "invoice_line_items" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "invoice_id" UUID,
    "sales_item_id" VARCHAR(255),
    "description" TEXT,
    "quantity" NUMERIC(10, 2),
    "rate" NUMERIC(12, 2),
    "discount" NUMERIC(12, 2),
    "tax_rate_id" VARCHAR(255),
    "tax_amount" NUMERIC(12, 2),
    "sac_code_id" VARCHAR(255),
    "total" NUMERIC(12, 2),
    "tally_service_ledger_name" VARCHAR(255),
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE
);


CREATE TABLE "recurring_engagements" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "client_id" UUID,
    "engagement_type_id" VARCHAR(255),
    "fees" NUMERIC(12, 2),
    "is_active" BOOLEAN,
    "assigned_to" TEXT[],
    "reported_to" VARCHAR(255),
    "last_generated_date" TIMESTAMPTZ,
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE
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

CREATE TABLE "client_categories" (
    "id" VARCHAR(255) PRIMARY KEY,
    "name" VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE "countries" (
    "code" VARCHAR(10) PRIMARY KEY,
    "name" VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE "permissions" (
    "feature" VARCHAR(255) PRIMARY KEY,
    "departments" TEXT[]
);

CREATE TABLE "tax_rates" (
    "id" VARCHAR(255) PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "rate" NUMERIC(5, 2),
    "is_default" BOOLEAN
);

CREATE TABLE "hsn_sac_codes" (
    "id" VARCHAR(255) PRIMARY KEY,
    "code" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "type" VARCHAR(10),
    "is_default" BOOLEAN
);

CREATE TABLE "sales_items" (
    "id" VARCHAR(255) PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "standard_price" NUMERIC(12, 2),
    "default_tax_rate_id" VARCHAR(255),
    "default_sac_id" VARCHAR(255),
    "associated_engagement_type_id" VARCHAR(255)
);

CREATE TABLE "engagement_notes" (
    "id" VARCHAR(255) PRIMARY KEY,
    "engagement_id" UUID,
    "client_id" UUID,
    "text" TEXT,
    "category" VARCHAR(50),
    "financial_year" VARCHAR(20),
    "created_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ,
    "mentions" TEXT[],
    FOREIGN KEY ("engagement_id") REFERENCES "engagements"("id") ON DELETE CASCADE
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
    "thread_id" VARCHAR(255),
    "sender_id" VARCHAR(255),
    "text" TEXT,
    "timestamp" TIMESTAMPTZ,
    FOREIGN KEY ("thread_id") REFERENCES "chat_threads"("id") ON DELETE CASCADE
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
    "location" TEXT,
    "engagement_id" UUID,
    "timezone" VARCHAR(100)
);

CREATE TABLE "leave_requests" (
    "id" VARCHAR(255) PRIMARY KEY,
    "employee_id" VARCHAR(255),
    "employee_name" VARCHAR(255),
    "start_date" TIMESTAMPTZ,
    "end_date" TIMESTAMPTZ,
    "reason" TEXT,
    "status" VARCHAR(50),
    "approved_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ,
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE
);
