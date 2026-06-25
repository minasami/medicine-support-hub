import { Router } from "express";
import { db, medicinesTable } from "@workspace/db";
import { like, or, ilike, sql } from "drizzle-orm";
import { ListMedicinesQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/medicines", async (req, res) => {
  try {
    const parsed = ListMedicinesQueryParams.safeParse(req.query);
    const search = parsed.success ? parsed.data.search : undefined;
    const limit = parsed.success ? (parsed.data.limit ?? 50) : 50;

    let results;
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      results = await db
        .select()
        .from(medicinesTable)
        .where(or(ilike(medicinesTable.name_en, term), ilike(medicinesTable.name_ar, term)))
        .limit(limit);
    } else {
      results = await db.select().from(medicinesTable).limit(limit);
    }

    res.json(results.map((m) => ({
      id: m.id,
      name_en: m.name_en,
      name_ar: m.name_ar,
      dosage_form: m.dosage_form,
      strength: m.strength ?? null,
      category: m.category ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list medicines");
    res.status(500).json({ error: "Failed to list medicines" });
  }
});

export default router;
