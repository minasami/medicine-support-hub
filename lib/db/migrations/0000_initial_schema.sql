CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE IF NOT EXISTS "activity_log" (
  "id" serial PRIMARY KEY,
  "request_id" integer NOT NULL,
  "requester_name" text NOT NULL,
  "action" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "medicine_requests" (
  "id" serial PRIMARY KEY,
  "requester_name" text NOT NULL,
  "requester_phone" text NOT NULL,
  "is_for_relative" boolean DEFAULT false NOT NULL,
  "patient_name" text,
  "patient_relation" text,
  "medicines" jsonb NOT NULL,
  "prescription_url" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "reviewer_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "urgency" text DEFAULT 'normal' NOT NULL,
  "wet_signature_required" boolean DEFAULT false NOT NULL,
  "employee_department" text,
  "pharmacy_notes" text,
  "batch_serial" text,
  "bin_location" text,
  "package_qr" text,
  "coordinator_notes" text
);

CREATE TABLE IF NOT EXISTS "medicines" (
  "id" serial PRIMARY KEY,
  "name_en" text NOT NULL,
  "name_ar" text NOT NULL,
  "dosage_form" text NOT NULL,
  "strength" text,
  "category" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
