import { Router } from "express";
import { db, requestsTable, activityTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { GetRecentActivityQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select({ status: requestsTable.status, count: sql<number>`cast(count(*) as int)` })
      .from(requestsTable)
      .groupBy(requestsTable.status);

    const map: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      map[row.status] = row.count;
      total += row.count;
    }

    res.json({
      total,
      pending: map["pending"] ?? 0,
      approved: map["approved"] ?? 0,
      rejected: map["rejected"] ?? 0,
      preparing: map["preparing"] ?? 0,
      ready: map["ready"] ?? 0,
      dispensing: map["dispensing"] ?? 0,
      dispensed: map["dispensed"] ?? 0,
      packaging: map["packaging"] ?? 0,
      packaged: map["packaged"] ?? 0,
      in_transit: map["in_transit"] ?? 0,
      delivered: map["delivered"] ?? 0,
      completed: map["completed"] ?? 0,
      closed: map["closed"] ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard summary");
    res.status(500).json({ error: "Failed to get summary" });
  }
});

router.get("/dashboard/recent-activity", requireAuth, async (req, res) => {
  try {
    const parsed = GetRecentActivityQueryParams.safeParse(req.query);
    const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;

    const rows = await db
      .select()
      .from(activityTable)
      .orderBy(desc(activityTable.createdAt))
      .limit(limit);

    res.json(
      rows.map((r) => ({
        id: r.id,
        request_id: r.request_id,
        requester_name: r.requester_name,
        action: r.action,
        status: r.status,
        created_at: r.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get recent activity");
    res.status(500).json({ error: "Failed to get recent activity" });
  }
});

export default router;
