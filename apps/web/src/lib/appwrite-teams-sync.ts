import { Client, Teams } from "appwrite";

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";

const client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
const teams = new Teams(client);

export interface TeamSyncParams {
  organizationId: string;
  organizationName: string;
  userEmail: string;
  userId?: string;
  role: string;
}

/**
 * Hybrid Sync: Mirrors Appwrite Database organization memberships to Appwrite Auth Teams
 * for native Appwrite Document Level RLS and Auth Team security.
 */
export async function syncOrganizationMembershipToAppwriteTeam({
  organizationId,
  organizationName,
  userEmail,
  userId,
  role,
}: TeamSyncParams): Promise<{ teamId: string; status: string }> {
  if (!userEmail) return { teamId: "", status: "skipped_no_email" };

  const cleanOrgId = (organizationId || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  const teamId = `team_${cleanOrgId}`.substring(0, 36);

  try {
    // 1. Check or create Appwrite Auth Team
    let teamExists = false;
    try {
      await teams.get(teamId);
      teamExists = true;
    } catch {
      teamExists = false;
    }

    if (!teamExists) {
      try {
        await teams.create(teamId, organizationName || `Org ${organizationId}`);
      } catch (err: any) {
        console.warn("[Appwrite Teams Sync] Team creation notice:", err?.message || err);
      }
    }

    // 2. Add or update user membership in Appwrite Auth Team
    try {
      const redirectUrl = typeof window !== "undefined" ? window.location.origin + "/account" : "https://medicinesupport.app/account";
      await teams.createMembership(
        teamId,
        [role || "member"],
        userEmail,
        userId || undefined,
        undefined,
        redirectUrl,
      );
    } catch (err: any) {
      console.warn("[Appwrite Teams Sync] Team membership notice:", err?.message || err);
    }

    return { teamId, status: "synced" };
  } catch (err: any) {
    console.warn("[Appwrite Teams Sync] Warning during team sync:", err?.message || err);
    return { teamId, status: "error" };
  }
}
