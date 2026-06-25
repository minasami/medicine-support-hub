import { pgTable, text, serial, timestamp, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const requestsTable = pgTable("medicine_requests", {
  id: serial("id").primaryKey(),
  requester_name: text("requester_name").notNull(),
  requester_phone: text("requester_phone").notNull(),
  is_for_relative: boolean("is_for_relative").notNull().default(false),
  patient_name: text("patient_name"),
  patient_relation: text("patient_relation"),
  medicines: jsonb("medicines").notNull().$type<Array<{
    medicine_id?: number | null;
    name_en: string;
    name_ar?: string | null;
    quantity: number;
    notes?: string | null;
  }>>(),
  prescription_url: text("prescription_url"),
  status: text("status").notNull().default("pending"),
  reviewer_notes: text("reviewer_notes"),
  // New fields for extended workflow
  urgency: text("urgency").notNull().default("normal"),
  wet_signature_required: boolean("wet_signature_required").notNull().default(false),
  employee_department: text("employee_department"),
  pharmacy_notes: text("pharmacy_notes"),
  batch_serial: text("batch_serial"),
  bin_location: text("bin_location"),
  package_qr: text("package_qr"),
  coordinator_notes: text("coordinator_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRequestSchema = createInsertSchema(requestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type MedicineRequest = typeof requestsTable.$inferSelect;
