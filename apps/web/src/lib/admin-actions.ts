/**
 * Automated platform-admin actions (Appwrite-first).
 *
 * Safety rules:
 * - Never auto-approve claims below the confidence threshold
 * - Never auto-publish medical content or deploy code
 * - All bulk actions return an audit trail
 */

import {
  listCompanyClaims,
  reviewCompanyClaim,
  type CompanyClaimRecord,
} from "@/lib/company-claims-data";

export type AdminActionId =
  | "approve_high_score_claims"
  | "reject_low_score_claims"
  | "refresh_claim_backlog"
  | "full_safe_pack";

export type AdminActionResult = {
  action: AdminActionId;
  ok: boolean;
  message: string;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  details: string[];
  at: string;
};

export type AdminActionOptions = {
  /** Minimum verification_score to auto-approve (default 85) */
  approveMinScore?: number;
  /** Maximum verification_score to auto-reject (default 25); null disables */
  rejectMaxScore?: number | null;
  /** Dry-run: report what would happen without writing */
  dryRun?: boolean;
  /** Cap how many claims to process in one run */
  limit?: number;
  actorEmail?: string;
};

const DEFAULT_APPROVE_MIN = 85;
const DEFAULT_REJECT_MAX = 25;
const DEFAULT_LIMIT = 50;

const AUDIT_KEY = "msh_admin_action_audit_v1";

function pushAudit(entry: AdminActionResult) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    const list: AdminActionResult[] = raw ? JSON.parse(raw) : [];
    list.unshift(entry);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    /* ignore */
  }
}

export function readAdminActionAudit(limit = 20): AdminActionResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    const list: AdminActionResult[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.slice(0, limit) : [];
  } catch {
    return [];
  }
}

function scoreOf(c: CompanyClaimRecord): number {
  const n = Number(c.verification_score);
  return Number.isFinite(n) ? n : 50;
}

async function approveHighScoreClaims(
  opts: AdminActionOptions,
): Promise<AdminActionResult> {
  const min = opts.approveMinScore ?? DEFAULT_APPROVE_MIN;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const dry = opts.dryRun === true;
  const { claims } = await listCompanyClaims({ status: "pending", limit: 100 });
  const eligible = claims
    .filter((c) => c.id && scoreOf(c) >= min)
    .slice(0, limit);

  let succeeded = 0;
  let failed = 0;
  const details: string[] = [];

  for (const c of eligible) {
    const label = `${c.company_name || c.company_slug} · ${c.work_email} (score ${scoreOf(c)})`;
    if (dry) {
      details.push(`Would approve: ${label}`);
      succeeded += 1;
      continue;
    }
    try {
      const saved = await reviewCompanyClaim(
        c.id!,
        "approved",
        `Auto-approve score≥${min} by ${opts.actorEmail || "admin"}`,
      );
      if (!saved) throw new Error("null result");
      succeeded += 1;
      details.push(`Approved: ${label}`);
    } catch (e: unknown) {
      failed += 1;
      details.push(
        `Failed ${label}: ${e instanceof Error ? e.message : "error"}`,
      );
    }
  }

  const result: AdminActionResult = {
    action: "approve_high_score_claims",
    ok: failed === 0,
    message: dry
      ? `Dry-run: ${eligible.length} claim(s) would be approved (score ≥ ${min}).`
      : `Approved ${succeeded}/${eligible.length} high-score claim(s) (score ≥ ${min}).`,
    processed: eligible.length,
    succeeded,
    failed,
    skipped: Math.max(0, claims.length - eligible.length),
    details,
    at: new Date().toISOString(),
  };
  if (!dry) pushAudit(result);
  return result;
}

async function rejectLowScoreClaims(
  opts: AdminActionOptions,
): Promise<AdminActionResult> {
  const max = opts.rejectMaxScore ?? DEFAULT_REJECT_MAX;
  if (max == null) {
    return {
      action: "reject_low_score_claims",
      ok: true,
      message: "Low-score auto-reject is disabled.",
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      details: [],
      at: new Date().toISOString(),
    };
  }
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const dry = opts.dryRun === true;
  const { claims } = await listCompanyClaims({ status: "pending", limit: 100 });
  const eligible = claims
    .filter((c) => c.id && scoreOf(c) <= max)
    .slice(0, limit);

  let succeeded = 0;
  let failed = 0;
  const details: string[] = [];

  for (const c of eligible) {
    const label = `${c.company_name || c.company_slug} · ${c.work_email} (score ${scoreOf(c)})`;
    if (dry) {
      details.push(`Would reject: ${label}`);
      succeeded += 1;
      continue;
    }
    try {
      const saved = await reviewCompanyClaim(
        c.id!,
        "rejected",
        `Auto-reject score≤${max} by ${opts.actorEmail || "admin"}`,
      );
      if (!saved) throw new Error("null result");
      succeeded += 1;
      details.push(`Rejected: ${label}`);
    } catch (e: unknown) {
      failed += 1;
      details.push(
        `Failed ${label}: ${e instanceof Error ? e.message : "error"}`,
      );
    }
  }

  const result: AdminActionResult = {
    action: "reject_low_score_claims",
    ok: failed === 0,
    message: dry
      ? `Dry-run: ${eligible.length} claim(s) would be rejected (score ≤ ${max}).`
      : `Rejected ${succeeded}/${eligible.length} low-score claim(s) (score ≤ ${max}).`,
    processed: eligible.length,
    succeeded,
    failed,
    skipped: Math.max(0, claims.length - eligible.length),
    details,
    at: new Date().toISOString(),
  };
  if (!dry) pushAudit(result);
  return result;
}

async function refreshClaimBacklog(): Promise<AdminActionResult> {
  const { claims, storage } = await listCompanyClaims({ limit: 200 });
  const pending = claims.filter((c) => c.status === "pending").length;
  const approved = claims.filter((c) => c.status === "approved").length;
  const result: AdminActionResult = {
    action: "refresh_claim_backlog",
    ok: true,
    message: `Backlog refreshed from ${storage}: ${claims.length} total, ${pending} pending, ${approved} approved.`,
    processed: claims.length,
    succeeded: claims.length,
    failed: 0,
    skipped: 0,
    details: [`storage=${storage}`, `pending=${pending}`, `approved=${approved}`],
    at: new Date().toISOString(),
  };
  pushAudit(result);
  return result;
}

/**
 * Safe pack: refresh backlog + auto-approve high-score only.
 * Does NOT auto-reject (requires explicit action).
 */
export async function runSafeAdminPack(
  opts: AdminActionOptions = {},
): Promise<AdminActionResult[]> {
  const refresh = await refreshClaimBacklog();
  const approve = await approveHighScoreClaims({
    ...opts,
    approveMinScore: opts.approveMinScore ?? DEFAULT_APPROVE_MIN,
  });
  const pack: AdminActionResult = {
    action: "full_safe_pack",
    ok: refresh.ok && approve.ok,
    message: `Safe pack: ${refresh.message} | ${approve.message}`,
    processed: refresh.processed + approve.processed,
    succeeded: refresh.succeeded + approve.succeeded,
    failed: refresh.failed + approve.failed,
    skipped: approve.skipped,
    details: [...refresh.details, ...approve.details],
    at: new Date().toISOString(),
  };
  if (!opts.dryRun) pushAudit(pack);
  return [refresh, approve, pack];
}

export async function runAdminAction(
  action: AdminActionId,
  opts: AdminActionOptions = {},
): Promise<AdminActionResult | AdminActionResult[]> {
  switch (action) {
    case "approve_high_score_claims":
      return approveHighScoreClaims(opts);
    case "reject_low_score_claims":
      return rejectLowScoreClaims(opts);
    case "refresh_claim_backlog":
      return refreshClaimBacklog();
    case "full_safe_pack":
      return runSafeAdminPack(opts);
    default:
      return {
        action,
        ok: false,
        message: `Unknown action: ${action}`,
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        details: [],
        at: new Date().toISOString(),
      };
  }
}

export const ADMIN_ACTION_CATALOG: {
  id: AdminActionId;
  label: string;
  description: string;
  safety: "safe" | "caution";
}[] = [
  {
    id: "full_safe_pack",
    label: "Run safe pack",
    description: "Refresh backlog + auto-approve claims with score ≥ 85",
    safety: "safe",
  },
  {
    id: "approve_high_score_claims",
    label: "Auto-approve high score",
    description: "Approve pending claims with verification_score ≥ 85",
    safety: "safe",
  },
  {
    id: "reject_low_score_claims",
    label: "Auto-reject low score",
    description: "Reject pending claims with verification_score ≤ 25",
    safety: "caution",
  },
  {
    id: "refresh_claim_backlog",
    label: "Refresh backlog",
    description: "Re-read claim queues from Appwrite / local mirror",
    safety: "safe",
  },
];
