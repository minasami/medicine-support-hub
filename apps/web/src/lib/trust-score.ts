/**
 * TrustScore for barcode-wiki contributors and RLAIF annotators.
 *
 *   Approved*3 − Rejected*5 + AccountAgeDays/30 + IsVerifiedRep*20 + IsPharmacist*30
 *
 * Auto-approve threshold: score > 50 (see processContribution).
 */

export const TRUST_AUTO_APPROVE_THRESHOLD = 50;

export type TrustInputs = {
  approved?: number;
  rejected?: number;
  accountAgeDays?: number;
  isVerifiedRep?: boolean | number;
  isPharmacist?: boolean | number;
};

export function computeTrustScore(input: TrustInputs): number {
  const approved = Math.max(0, Number(input.approved) || 0);
  const rejected = Math.max(0, Number(input.rejected) || 0);
  const ageDays = Math.max(0, Number(input.accountAgeDays) || 0);
  const verified = input.isVerifiedRep === true || Number(input.isVerifiedRep) === 1 ? 1 : 0;
  const pharmacist = input.isPharmacist === true || Number(input.isPharmacist) === 1 ? 1 : 0;
  const raw = approved * 3 - rejected * 5 + ageDays / 30 + verified * 20 + pharmacist * 30;
  return Math.round(raw * 100) / 100;
}

export function shouldAutoApprove(score: number, threshold = TRUST_AUTO_APPROVE_THRESHOLD): boolean {
  return Number(score) > threshold;
}

export function accountAgeDaysFrom(createdAt?: string | Date | null, now = Date.now()): number {
  if (!createdAt) return 0;
  const t = createdAt instanceof Date ? createdAt.getTime() : Date.parse(String(createdAt));
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (now - t) / 86_400_000);
}
