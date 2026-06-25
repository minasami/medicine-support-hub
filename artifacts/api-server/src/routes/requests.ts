import { Router } from "express";
import { db, requestsTable, activityTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { ListRequestsQueryParams, CreateRequestBody, GetRequestParams, UpdateRequestParams, UpdateRequestBody, UploadPrescriptionParams, UploadPrescriptionBody } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth.js";
import path from "path";
import fs from "fs";

const router = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function serializeRequest(r: typeof requestsTable.$inferSelect) {
  return {
    id: r.id,
    requester_name: r.requester_name,
    requester_phone: r.requester_phone,
    is_for_relative: r.is_for_relative,
    patient_name: r.patient_name ?? null,
    patient_relation: r.patient_relation ?? null,
    medicines: (r.medicines as any[]) ?? [],
    prescription_url: r.prescription_url ?? null,
    status: r.status,
    reviewer_notes: r.reviewer_notes ?? null,
    urgency: r.urgency ?? "normal",
    wet_signature_required: r.wet_signature_required ?? false,
    employee_department: r.employee_department ?? null,
    pharmacy_notes: r.pharmacy_notes ?? null,
    batch_serial: r.batch_serial ?? null,
    bin_location: r.bin_location ?? null,
    package_qr: r.package_qr ?? null,
    coordinator_notes: r.coordinator_notes ?? null,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

const ROLE_ALLOWED_STATUSES: Record<string, string[]> = {
  REVIEWER:          ["approved", "rejected", "closed"],
  PHYSICIAN:         ["approved", "rejected"],
  PHARMACIST:        ["dispensing", "dispensed", "packaging", "packaged"],
  PHARMACY_ASSISTANT:["preparing", "dispensing", "ready"],
  DELIVERY_MAN:      ["in_transit", "delivered", "completed"],
  BRANCH_MANAGER:    [],
  COSMETICIAN:       [],
  DATA_ENTRY:        [],
  PLATFORM_ADMIN:    [],
};

const ROLE_ALLOWED_FIELDS: Record<string, string[]> = {
  REVIEWER:          ["status", "reviewer_notes"],
  PHYSICIAN:         ["status", "reviewer_notes"],
  PHARMACIST:        ["status", "pharmacy_notes", "batch_serial", "bin_location", "package_qr"],
  PHARMACY_ASSISTANT:["status", "pharmacy_notes"],
  DELIVERY_MAN:      ["status", "coordinator_notes"],
  BRANCH_MANAGER:    [],
  COSMETICIAN:       [],
  DATA_ENTRY:        [],
  PLATFORM_ADMIN:    ["status", "reviewer_notes", "pharmacy_notes", "batch_serial", "bin_location", "package_qr", "coordinator_notes"],
};

router.get("/requests", requireAuth, async (req, res) => {
  try {
    const parsed = ListRequestsQueryParams.safeParse(req.query);
    const status = parsed.success ? parsed.data.status : undefined;
    const limit = parsed.success ? (parsed.data.limit ?? 50) : 50;
    const offset = parsed.success ? (parsed.data.offset ?? 0) : 0;

    if (status) {
      const results = await db
        .select()
        .from(requestsTable)
        .where(eq(requestsTable.status, status))
        .orderBy(desc(requestsTable.createdAt))
        .limit(limit)
        .offset(offset);
      res.json(results.map(serializeRequest));
      return;
    }

    const results = await db
      .select()
      .from(requestsTable)
      .orderBy(desc(requestsTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(results.map(serializeRequest));
  } catch (err) {
    req.log.error({ err }, "Failed to list requests");
    res.status(500).json({ error: "Failed to list requests" });
  }
});

router.post("/requests", async (req, res) => {
  try {
    const parsed = CreateRequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const data = parsed.data;

    const [inserted] = await db
      .insert(requestsTable)
      .values({
        requester_name: data.requester_name,
        requester_phone: data.requester_phone,
        is_for_relative: data.is_for_relative,
        patient_name: data.patient_name ?? null,
        patient_relation: data.patient_relation ?? null,
        medicines: (data.medicines as any) ?? [],
        prescription_url: data.prescription_url ?? null,
        status: "pending",
        urgency: (data as any).urgency ?? "normal",
        wet_signature_required: (data as any).wet_signature_required ?? false,
        employee_department: (data as any).employee_department ?? null,
      })
      .returning();

    await db.insert(activityTable).values({
      request_id: inserted.id,
      requester_name: inserted.requester_name,
      action: "Request submitted",
      status: "pending",
    });

    res.status(201).json(serializeRequest(inserted));
  } catch (err) {
    req.log.error({ err }, "Failed to create request");
    res.status(500).json({ error: "Failed to create request" });
  }
});

// Public minimal tracking — returns only id, status, timestamps (no PII)
router.get("/requests/:id/track", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const [row] = await db.select().from(requestsTable).where(eq(requestsTable.id, id));
    if (!row) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json({
      id: row.id,
      status: row.status,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to track request");
    res.status(500).json({ error: "Failed to track request" });
  }
});

router.get("/requests/:id", requireAuth, async (req, res) => {
  try {
    const parsed = GetRequestParams.safeParse({ id: Number(req.params.id) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const [row] = await db.select().from(requestsTable).where(eq(requestsTable.id, parsed.data.id));
    if (!row) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json(serializeRequest(row));
  } catch (err) {
    req.log.error({ err }, "Failed to get request");
    res.status(500).json({ error: "Failed to get request" });
  }
});

router.patch("/requests/:id", requireAuth, async (req, res) => {
  try {
    const idParsed = UpdateRequestParams.safeParse({ id: Number(req.params.id) });
    const bodyParsed = UpdateRequestBody.safeParse(req.body);
    if (!idParsed.success || !bodyParsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const session = (req as any).session as { role: string };
    const role = session.role;
    const body = bodyParsed.data as any;

    const allowedFields = ROLE_ALLOWED_FIELDS[role] ?? [];
    const allowedStatuses = ROLE_ALLOWED_STATUSES[role] ?? [];

    if (allowedFields.length === 0) {
      res.status(403).json({ error: "Your role cannot modify requests" });
      return;
    }

    if (body.status !== undefined && role !== "PLATFORM_ADMIN" && !allowedStatuses.includes(body.status)) {
      res.status(403).json({ error: `Your role cannot set status to '${body.status}'` });
      return;
    }

    const updates: Partial<typeof requestsTable.$inferInsert> = {};
    if (body.status !== undefined && allowedFields.includes("status")) updates.status = body.status;
    if (body.reviewer_notes !== undefined && allowedFields.includes("reviewer_notes")) updates.reviewer_notes = body.reviewer_notes ?? null;
    if (body.pharmacy_notes !== undefined && allowedFields.includes("pharmacy_notes")) updates.pharmacy_notes = body.pharmacy_notes ?? null;
    if (body.batch_serial !== undefined && allowedFields.includes("batch_serial")) updates.batch_serial = body.batch_serial ?? null;
    if (body.bin_location !== undefined && allowedFields.includes("bin_location")) updates.bin_location = body.bin_location ?? null;
    if (body.package_qr !== undefined && allowedFields.includes("package_qr")) updates.package_qr = body.package_qr ?? null;
    if (body.coordinator_notes !== undefined && allowedFields.includes("coordinator_notes")) updates.coordinator_notes = body.coordinator_notes ?? null;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No allowed fields to update" });
      return;
    }

    const [updated] = await db
      .update(requestsTable)
      .set(updates)
      .where(eq(requestsTable.id, idParsed.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    if (body.status) {
      await db.insert(activityTable).values({
        request_id: updated.id,
        requester_name: updated.requester_name,
        action: `Status updated to ${body.status}`,
        status: body.status,
      });
    }

    res.json(serializeRequest(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update request");
    res.status(500).json({ error: "Failed to update request" });
  }
});

router.post("/requests/:id/prescription", async (req, res) => {
  try {
    const idParsed = UploadPrescriptionParams.safeParse({ id: Number(req.params.id) });
    const bodyParsed = UploadPrescriptionBody.safeParse(req.body);
    if (!idParsed.success || !bodyParsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const { image_base64, filename } = bodyParsed.data;
    const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = path.join(uploadsDir, safeName);
    const buffer = Buffer.from(image_base64.replace(/^data:[^;]+;base64,/, ""), "base64");
    fs.writeFileSync(filePath, buffer);

    const prescriptionUrl = `/api/uploads/${safeName}`;
    const [updated] = await db
      .update(requestsTable)
      .set({ prescription_url: prescriptionUrl })
      .where(eq(requestsTable.id, idParsed.data.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    res.json(serializeRequest(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to upload prescription");
    res.status(500).json({ error: "Failed to upload prescription" });
  }
});

export default router;
