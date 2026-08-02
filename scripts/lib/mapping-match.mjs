/**
 * Pure static→live matching helpers (shared by map script + accuracy tests).
 * Confidence scores documented in docs/mapping-confidence-scores.md
 */

export function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normCode(s) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9._-]/g, "");
}

export function normMfr(s) {
  return String(s || "")
    .toLowerCase()
    .replace(
      /\b(s\.a\.e\.?|sae|ltd|llc|inc|co\.?|company|pharma|pharmaceuticals?)\b/gi,
      "",
    )
    .replace(/[^a-z0-9\u0600-\u06ff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token Jaccard similarity in [0, 1]. */
export function nameSimilarity(a, b) {
  const ta = new Set(normName(a).split(" ").filter(Boolean));
  const tb = new Set(normName(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter);
}

export function buildLiveIndexes(liveList) {
  const byNameEn = new Map();
  const byNameAr = new Map();
  const byBarcode = new Map();
  const byCode = new Map();

  for (const row of liveList) {
    const id = row.canonical_id;
    if (id == null || Number.isNaN(Number(id))) continue;

    const ne = normName(row.name_en);
    const na = normName(row.name_ar);
    if (ne) {
      if (!byNameEn.has(ne)) byNameEn.set(ne, []);
      byNameEn.get(ne).push(row);
    }
    if (na) {
      if (!byNameAr.has(na)) byNameAr.set(na, []);
      byNameAr.get(na).push(row);
    }
    const bc = normCode(row.barcode);
    const cd = normCode(row.code);
    if (bc) {
      if (!byBarcode.has(bc)) byBarcode.set(bc, []);
      byBarcode.get(bc).push(row);
    }
    if (cd) {
      if (!byCode.has(cd)) byCode.set(cd, []);
      byCode.get(cd).push(row);
    }
  }

  return { byNameEn, byNameAr, byBarcode, byCode };
}

/**
 * @returns {{ row, method, confidence, ambiguous, candidates }}
 */
export function disambiguate(staticRow, candidates) {
  if (!candidates.length) {
    return {
      row: null,
      method: "unmatched",
      confidence: 0,
      ambiguous: false,
      candidates: [],
    };
  }
  if (candidates.length === 1) {
    return {
      row: candidates[0],
      method: "unique",
      confidence: 1,
      ambiguous: false,
      candidates: candidates.map((c) => Number(c.canonical_id)),
    };
  }

  const sBc = normCode(staticRow.barcode);
  const sCd = normCode(staticRow.code);
  const sMfr = normMfr(staticRow.manufacturer);

  if (sBc) {
    const hit = candidates.filter((c) => normCode(c.barcode) === sBc);
    if (hit.length === 1) {
      return {
        row: hit[0],
        method: "dup_barcode",
        confidence: 0.98,
        ambiguous: false,
        candidates: candidates.map((c) => Number(c.canonical_id)),
      };
    }
  }

  if (sCd) {
    const hit = candidates.filter((c) => normCode(c.code) === sCd);
    if (hit.length === 1) {
      return {
        row: hit[0],
        method: "dup_code",
        confidence: 0.95,
        ambiguous: false,
        candidates: candidates.map((c) => Number(c.canonical_id)),
      };
    }
  }

  if (sMfr) {
    const hit = candidates.filter((c) => {
      const m = normMfr(c.manufacturer);
      return m && (m === sMfr || m.includes(sMfr) || sMfr.includes(m));
    });
    if (hit.length === 1) {
      return {
        row: hit[0],
        method: "dup_manufacturer",
        confidence: 0.85,
        ambiguous: false,
        candidates: candidates.map((c) => Number(c.canonical_id)),
      };
    }
    if (hit.length > 1) {
      let best = hit[0];
      let bestSim = -1;
      for (const h of hit) {
        const sim = Math.max(
          nameSimilarity(staticRow.name_en, h.name_en),
          nameSimilarity(staticRow.name_ar, h.name_ar),
        );
        if (sim > bestSim) {
          bestSim = sim;
          best = h;
        }
      }
      if (bestSim >= 0.6) {
        return {
          row: best,
          method: "dup_mfr_similarity",
          confidence: Math.min(0.8, 0.5 + bestSim * 0.3),
          ambiguous: hit.length > 2,
          candidates: candidates.map((c) => Number(c.canonical_id)),
        };
      }
    }
  }

  return {
    row: null,
    method: "ambiguous_duplicate",
    confidence: 0,
    ambiguous: true,
    candidates: candidates.map((c) => Number(c.canonical_id)),
  };
}

export function matchStaticRow(s, indexes) {
  const { byNameEn, byNameAr, byBarcode, byCode } = indexes;
  const ne = normName(s.name_en);
  const na = normName(s.name_ar);
  const bc = normCode(s.barcode);
  const cd = normCode(s.code);

  if (bc && byBarcode.has(bc)) {
    const r = disambiguate(s, byBarcode.get(bc));
    if (r.row) {
      return {
        ...r,
        method: r.method === "unique" ? "exact_barcode" : r.method,
        confidence: r.method === "unique" ? 0.99 : r.confidence,
      };
    }
  }
  if (cd && byCode.has(cd)) {
    const r = disambiguate(s, byCode.get(cd));
    if (r.row) {
      return {
        ...r,
        method: r.method === "unique" ? "exact_code" : r.method,
        confidence: r.method === "unique" ? 0.97 : r.confidence,
      };
    }
  }

  if (ne && byNameEn.has(ne)) {
    const r = disambiguate(s, byNameEn.get(ne));
    if (r.row) {
      return {
        ...r,
        method: r.method === "unique" ? "exact_name_en" : r.method,
        confidence: r.method === "unique" ? 0.92 : r.confidence,
      };
    }
    if (r.ambiguous) return r;
  }

  if (na && byNameAr.has(na)) {
    const r = disambiguate(s, byNameAr.get(na));
    if (r.row) {
      return {
        ...r,
        method: r.method === "unique" ? "exact_name_ar" : r.method,
        confidence: r.method === "unique" ? 0.9 : r.confidence,
      };
    }
    if (r.ambiguous) return r;
  }

  return {
    row: null,
    method: "unmatched",
    confidence: 0,
    ambiguous: false,
    candidates: [],
  };
}

/**
 * Aggregate accuracy from map rows with { confidence, live_canonical_id, match_method, static_name_en, live_name_en }.
 */
export function runAccuracyAudit(mapRows) {
  const matched = mapRows.filter((r) => r.live_canonical_id != null);
  const confidences = matched.map((r) => r.confidence || 0);
  const avgConf =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

  const high = matched.filter((r) => (r.confidence || 0) >= 0.9).length;
  const medium = matched.filter(
    (r) => (r.confidence || 0) >= 0.7 && (r.confidence || 0) < 0.9,
  ).length;
  const low = matched.filter(
    (r) => (r.confidence || 0) > 0 && (r.confidence || 0) < 0.7,
  ).length;

  const weakNameMatches = matched.filter((r) => {
    if (!r.static_name_en || !r.live_name_en) return false;
    if (r.match_method?.includes("barcode") || r.match_method?.includes("code"))
      return false;
    return nameSimilarity(r.static_name_en, r.live_name_en) < 0.5;
  });

  const accuracy_score =
    matched.length === 0
      ? 0
      : Math.round(
          ((high + medium * 0.7 + low * 0.4) / matched.length) * 1000,
        ) / 10;

  return {
    matched_count: matched.length,
    unmatched_count: mapRows.filter((r) => r.match_method === "unmatched")
      .length,
    ambiguous_count: mapRows.filter((r) => r.ambiguous).length,
    confidence: {
      average: Math.round(avgConf * 1000) / 1000,
      high_ge_0_9: high,
      medium_0_7_to_0_9: medium,
      low_lt_0_7: low,
    },
    accuracy_score_percent: accuracy_score,
    weak_name_match_count: weakNameMatches.length,
    pass:
      accuracy_score >= 70 &&
      weakNameMatches.length / Math.max(matched.length, 1) < 0.05,
  };
}

export function mapCorpus(staticList, liveList) {
  const indexes = buildLiveIndexes(liveList);
  return staticList.map((s) => {
    const result = matchStaticRow(s, indexes);
    const live = result.row;
    const liveId =
      live?.canonical_id != null ? Number(live.canonical_id) : null;
    return {
      static_name_en: s.name_en || null,
      live_canonical_id: liveId,
      live_name_en: live?.name_en || null,
      match_method: result.method,
      confidence: result.confidence,
      ambiguous: result.ambiguous,
      candidate_live_ids: result.candidates,
    };
  });
}
