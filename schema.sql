-- schema.sql

-- Drop tables in reverse order of dependency to avoid foreign key constraints errors
DROP TABLE IF EXISTS "activity_log";
DROP TABLE IF EXISTS "timesheets";
DROP TABLE IF EXISTS "tasks";
DROP TABLE IF EXISTS "engagements";
DROP TABLE IF EXISTS "clients";
DROP TABLE IF EXISTS "employees";
DROP TABLE IF EXISTS "departments";
DROP TABLE IF EXISTS "engagementTypes";
DROP TABLE IF EXISTS "clientCategories";
DROP TABLE IF EXISTS "firms";
DROP TABLE IF EXISTS "permissions";
DROP TABLE IF EXISTS "countries";
DROP TABLE IF EXISTS "taxRates";
DROP TABLE IF EXISTS "hsnSacCodes";
DROP TABLE IF EXISTS "salesItems";
DROP TABLE IF EXISTS "recurringEngagements";
DROP TABLE IF EXISTS "todos";
DROP TABLE IF EXISTS "communications";
DROP TABLE IF EXISTS "chatMessages";
DROP TABLE IF EXISTS "leaveRequests";
DROP TABLE IF EXISTS "events";


-- Create tables

CREATE TABLE "employees" (
  "id" VARCHAR(255) PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "designation" VARCHAR(255),
  "avatar" VARCHAR(255),
  "role" TEXT[],
  "managerId" VARCHAR(255),
  "linkedin" VARCHAR(255),
  "emergencyContact" VARCHAR(255),
  "bloodGroup" VARCHAR(255),
  "leaveAllowance" INTEGER,
  "leavesTaken" INTEGER
);

CREATE TABLE "clients" (
  "id" VARCHAR(255) PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "mailId" VARCHAR(255),
  "mobileNumber" VARCHAR(255),
  "category" VARCHAR(255),
  "partnerId" VARCHAR(255),
  "firmId" VARCHAR(255),
  "phoneNumber" VARCHAR(255),
  "dateOfBirth" TIMESTAMP,
  "linkedClientIds" TEXT[],
  "pan" VARCHAR(255),
  "gstin" VARCHAR(255),
  "billingAddressLine1" VARCHAR(255),
  "billingAddressLine2" VARCHAR(255),
  "billingAddressLine3" VARCHAR(255),
  "pincode" VARCHAR(255),
  "state" VARCHAR(255),
  "country" VARCHAR(255),
  "contactPerson" VARCHAR(255),
  "contactPersonDesignation" VARCHAR(255),
  "createdAt" TIMESTAMP,
  "lastUpdated" TIMESTAMP
);

CREATE TABLE "engagements" (
  "id" VARCHAR(255) PRIMARY KEY,
  "clientId" VARCHAR(255),
  "remarks" TEXT,
  "type" VARCHAR(255),
  "assignedTo" TEXT[],
  "reportedTo" VARCHAR(255),
  "dueDate" TIMESTAMP,
  "status" VARCHAR(255),
  "billStatus" VARCHAR(255),
  "billSubmissionDate" TIMESTAMP,
  "fees" NUMERIC,
  "notes" TEXT
);

CREATE TABLE "tasks" (
  "id" VARCHAR(255) PRIMARY KEY,
  "engagementId" VARCHAR(255),
  "title" VARCHAR(255),
  "status" VARCHAR(255),
  "order" INTEGER,
  "assignedTo" VARCHAR(255)
);

CREATE TABLE "activity_log" (
  "id" SERIAL PRIMARY KEY,
  "engagement_id" VARCHAR(255),
  "client_id" VARCHAR(255),
  "type" VARCHAR(255),
  "user_id" VARCHAR(255),
  "user_name" VARCHAR(255),
  "details" JSONB,
  "timestamp" TIMESTAMP
);

CREATE TABLE "engagementTypes" (
    "id" VARCHAR(255) PRIMARY KEY,
    "name" VARCHAR(255),
    "description" TEXT,
    "subTaskTitles" TEXT[],
    "applicableCategories" TEXT[],
    "recurrence" VARCHAR(50)
);

CREATE TABLE "departments" (
    "id" VARCHAR(255) PRIMARY KEY,
    "name" VARCHAR(255) UNIQUE,
    "order" INTEGER
);

CREATE TABLE "todos" (
    "id" VARCHAR(255) PRIMARY KEY,
    "type" VARCHAR(255),
    "text" TEXT,
    "createdBy" VARCHAR(255),
    "assignedTo" TEXT[],
    "relatedEntity" JSONB,
    "isCompleted" BOOLEAN,
    "createdAt" TIMESTAMP,
    "completedAt" TIMESTAMP,
    "completedBy" VARCHAR(255)
);
