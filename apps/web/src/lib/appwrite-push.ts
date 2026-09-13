/**
 * Appwrite Messaging push registration.
 *
 * Primary: account.createPushTarget / updatePushTarget (Appwrite Messaging).
 * Mirror:  optional upsert into collection `fcm_tokens` for ops / sendPush fallback.
 *
 * FCM google-services.json is still required on Android as the *transport*
 * configured under Appwrite Console → Messaging → FCM provider — the app
 * never calls Firebase Admin.
 */
import { ID, Query } from "appwrite";
import { Capacitor } from "@capacitor/core";
import { account, databases } from "@/lib/appwrite";

const DATABASE_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_APPWRITE_DATABASE_ID) ||
  "medicine_support_hub";
const COLLECTION_ID = "fcm_tokens";
const PROVIDER_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_APPWRITE_MESSAGING_PROVIDER_ID) ||
  undefined;

const TARGET_STORAGE_KEY = "msh_appwrite_push_target_id";

function readStoredTargetId(): string | null {
  try {
    return localStorage.getItem(TARGET_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeTargetId(id: string) {
  try {
    localStorage.setItem(TARGET_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Register / refresh device token with Appwrite Messaging + optional mirror. */
export async function syncPushTokenToAppwrite(token: string): Promise<{
  ok: boolean;
  targetId?: string;
  mirrored?: boolean;
  error?: string;
}> {
  if (!token?.trim()) return { ok: false, error: "empty_token" };

  try {
    await account.get();
  } catch {
    return { ok: false, error: "not_authenticated" };
  }

  let targetId = readStoredTargetId();
  try {
    if (targetId) {
      try {
        await account.updatePushTarget(targetId, token);
      } catch {
        targetId = ID.unique();
        await account.createPushTarget(
          targetId,
          token,
          PROVIDER_ID || undefined,
        );
        storeTargetId(targetId);
      }
    } else {
      targetId = ID.unique();
      await account.createPushTarget(targetId, token, PROVIDER_ID || undefined);
      storeTargetId(targetId);
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // Best-effort mirror for sendPush audience fallback / admin visibility
  let mirrored = false;
  try {
    mirrored = await mirrorFcmToken(token);
  } catch {
    mirrored = false;
  }

  return { ok: true, targetId, mirrored };
}

/** @deprecated use syncPushTokenToAppwrite — kept for call-site compatibility */
export async function upsertFcmToken(token: string): Promise<boolean> {
  const result = await syncPushTokenToAppwrite(token);
  return result.ok;
}

async function mirrorFcmToken(token: string): Promise<boolean> {
  try {
    const user = await account.get();
    if (!user?.$id) return false;
    const platform = Capacitor.getPlatform();
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.equal("user_id", user.$id),
      Query.equal("token", token),
      Query.limit(1),
    ]);
    const payload = {
      user_id: user.$id,
      token,
      platform,
      updated_at: new Date().toISOString(),
    };
    if (existing.documents.length) {
      await databases.updateDocument(
        DATABASE_ID,
        COLLECTION_ID,
        existing.documents[0].$id,
        payload,
      );
    } else {
      await databases.createDocument(
        DATABASE_ID,
        COLLECTION_ID,
        ID.unique(),
        payload,
      );
    }
    return true;
  } catch {
    return false;
  }
}
