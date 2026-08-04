/**
 * Platform-admin detection shared by /admin hub and other gates.
 *
 * Sources (any one is enough):
 *  1. profiles.role / staff role containing ADMIN
 *  2. Founder / operator email allowlist (Appwrite patient login path)
 *  3. Explicit Appwrite labels/prefs when provided
 */

const FOUNDER_ADMIN_EMAILS = [
  "jesussavedmina@gmail.com",
  "mina.s.saad@pharma.asu.edu.eg",
  "mina.s.tawfik@armaniousfoundation.org",
] as const;

export function normalizeEmail(email: string | null | undefined): string {
  return String(email || "")
    .toLowerCase()
    .trim();
}

export function isFounderAdminEmail(email: string | null | undefined): boolean {
  const e = normalizeEmail(email);
  if (!e) return false;
  if (FOUNDER_ADMIN_EMAILS.includes(e as (typeof FOUNDER_ADMIN_EMAILS)[number])) {
    return true;
  }
  // Legacy inference used across auth.tsx
  if (e.includes("jesussavedmina")) return true;
  if (e.includes("admin@") || e.startsWith("admin.")) return true;
  return false;
}

export function roleLooksLikePlatformAdmin(
  role: string | null | undefined,
): boolean {
  const r = String(role || "")
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (!r) return false;
  if (r.includes("ADMIN")) return true;
  if (r === "PLATFORM_ADMIN" || r === "SUPER_ADMIN" || r === "PLATFORMADMIN") {
    return true;
  }
  return false;
}

export type PlatformAdminCheckInput = {
  email?: string | null;
  profileRole?: string | null;
  labels?: string[] | null;
};

/** True if this user should access /admin command hub and claim review. */
export function isPlatformAdminUser(input: PlatformAdminCheckInput): boolean {
  if (roleLooksLikePlatformAdmin(input.profileRole)) return true;
  if (isFounderAdminEmail(input.email)) return true;
  for (const l of input.labels || []) {
    const v = String(l || "")
      .toLowerCase()
      .trim();
    if (v === "platform_admin" || v === "admin" || v === "super_admin") {
      return true;
    }
  }
  return false;
}

export const PLATFORM_FOUNDER_EMAILS = FOUNDER_ADMIN_EMAILS;
