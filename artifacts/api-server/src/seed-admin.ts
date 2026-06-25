import { db } from "@workspace/db";
import { usersTable, branchesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./lib/auth.js";

export async function seedAdminUser() {
  const existing = await db.select().from(usersTable).where(eq(usersTable.username, "admin")).limit(1);
  if (existing.length > 0) return;

  const [branch] = await db.insert(branchesTable).values({
    name: "Main Branch",
    name_ar: "الفرع الرئيسي",
  }).returning();

  await db.insert(usersTable).values([
    {
      username: "admin",
      password_hash: hashPassword("admin123"),
      display_name: "Platform Administrator",
      role: "PLATFORM_ADMIN",
      branch_id: branch.id,
      active: true,
    },
    {
      username: "reviewer1",
      password_hash: hashPassword("reviewer123"),
      display_name: "Dr. Sarah Al-Mansouri",
      role: "REVIEWER",
      branch_id: branch.id,
      active: true,
    },
    {
      username: "pharmacist1",
      password_hash: hashPassword("pharm123"),
      display_name: "Ahmad Khalil",
      role: "PHARMACIST",
      branch_id: branch.id,
      active: true,
    },
    {
      username: "assistant1",
      password_hash: hashPassword("assist123"),
      display_name: "Fatima Hassan",
      role: "PHARMACY_ASSISTANT",
      branch_id: branch.id,
      active: true,
    },
    {
      username: "physician1",
      password_hash: hashPassword("doc123"),
      display_name: "Dr. Omar Nasser",
      role: "PHYSICIAN",
      branch_id: branch.id,
      active: true,
    },
    {
      username: "delivery1",
      password_hash: hashPassword("deliver123"),
      display_name: "Khalid Al-Rashid",
      role: "DELIVERY_MAN",
      branch_id: branch.id,
      active: true,
    },
    {
      username: "manager1",
      password_hash: hashPassword("manager123"),
      display_name: "Nora Al-Zahra",
      role: "BRANCH_MANAGER",
      branch_id: branch.id,
      active: true,
    },
    {
      username: "cosmetician1",
      password_hash: hashPassword("cosme123"),
      display_name: "Layla Mahmoud",
      role: "COSMETICIAN",
      branch_id: branch.id,
      active: true,
    },
    {
      username: "dataentry1",
      password_hash: hashPassword("data123"),
      display_name: "Rana Saleh",
      role: "DATA_ENTRY",
      branch_id: branch.id,
      active: true,
    },
  ]);
}
