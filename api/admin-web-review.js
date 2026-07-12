import { errorStatus, parseBody, requirePlatformAdmin, sendJson, supabaseRest } from "./_platform-server.js";

function summary(candidate) {
  const extracted = candidate.extracted_data || {};
  const value = String(extracted.summary || extracted.description || "Structured evidence extracted from an attributed web source and submitted for human verification.").trim();
  return value.length >= 10 ? value.slice(0, 4000) : `${value} Source review required.`;
}

function title(candidate) {
  return String(candidate.source_title || `${candidate.entity_type} web evidence`).trim().slice(0, 240);
}

function price(extracted) {
  const value = Number(extracted?.price_egp);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export default async function handler(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { message: "POST required." });
  try {
    const context = await requirePlatformAdmin(request);
    const body = parseBody(request);
    const candidateId = String(body.candidate_id || "");
    const decision = String(body.decision || "");
    const reviewNotes = String(body.review_notes || "").trim() || null;
    if (!candidateId || !["approved", "rejected"].includes(decision)) {
      return sendJson(response, 400, { message: "candidate_id and an approved/rejected decision are required." });
    }

    const candidates = await supabaseRest(context, `/rest/v1/web_ingestion_candidates?select=*&id=eq.${encodeURIComponent(candidateId)}&limit=1`);
    const candidate = candidates?.[0];
    if (!candidate || !["pending", "approved"].includes(candidate.status)) {
      return sendJson(response, 409, { message: "Candidate is missing or no longer reviewable." });
    }

    if (decision === "rejected") {
      await supabaseRest(context, `/rest/v1/web_ingestion_candidates?id=eq.${candidate.id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "rejected", review_notes: reviewNotes, reviewed_by: context.user.id, reviewed_at: new Date().toISOString() }),
      });
      return sendJson(response, 200, { status: "rejected", candidate_id: candidate.id });
    }

    let promotedRecordId = null;
    let queue = null;
    if (candidate.entity_type === "medicine" && candidate.canonical_id) {
      const observedPrice = price(candidate.extracted_data);
      const inserted = await supabaseRest(context, "/rest/v1/medicine_collaboration_submissions?select=id", {
        method: "POST", headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          canonical_id: candidate.canonical_id,
          contribution_type: observedPrice ? "price_observation" : "product_evidence",
          title: title(candidate), summary: summary(candidate), proposed_price_egp: observedPrice,
          evidence_urls: [candidate.source_url], submitted_by: context.user.id,
          organization_name: "Firecrawl attributed source", status: "submitted",
        }),
      });
      promotedRecordId = inserted?.[0]?.id || null;
      queue = "medicine_contribution";
    } else if (candidate.entity_type === "company" && candidate.company_slug) {
      const profiles = await supabaseRest(context, `/rest/v1/industry_company_profiles?select=id,organization_id,company_slug&company_slug=eq.${encodeURIComponent(candidate.company_slug)}&verification_status=eq.verified&limit=1`);
      const profile = profiles?.[0];
      if (profile?.id && profile?.organization_id) {
        const inserted = await supabaseRest(context, "/rest/v1/industry_company_contributions?select=id", {
          method: "POST", headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            profile_id: profile.id, organization_id: profile.organization_id, company_slug: profile.company_slug,
            contribution_type: "evidence", title: title(candidate), summary: summary(candidate),
            payload: candidate.extracted_data || {}, evidence_urls: [candidate.source_url],
            status: "submitted", submitted_by: context.user.id,
          }),
        });
        promotedRecordId = inserted?.[0]?.id || null;
        queue = "company_contribution";
      }
    }

    const promoted = Boolean(promotedRecordId);
    await supabaseRest(context, `/rest/v1/web_ingestion_candidates?id=eq.${candidate.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status: promoted ? "promoted" : "approved",
        review_notes: reviewNotes,
        promoted_record_id: promotedRecordId,
        reviewed_by: context.user.id,
        reviewed_at: new Date().toISOString(),
      }),
    });
    return sendJson(response, 200, {
      status: promoted ? "promoted" : "approved",
      candidate_id: candidate.id,
      record_id: promotedRecordId,
      queue,
      promotion: promoted ? "submitted_for_existing_moderation" : "manual_matching_required",
    });
  } catch (error) {
    console.error("admin-web-review", error);
    return sendJson(response, errorStatus(error), { message: error instanceof Error ? error.message : "Could not review web evidence." });
  }
}
