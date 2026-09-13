/**
 * Share helpers for drug / rx / invite deep links (Capacitor Share + Web Share).
 */
import { Capacitor } from "@capacitor/core";
import {
  drugDeepLink,
  inviteDeepLink,
  rxDeepLink,
} from "@/lib/deep-links";

async function sharePayload(title: string, text: string, url: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      try {
        const { Share } = await import("@capacitor/share");
        await Share.share({ title, text, url, dialogTitle: title });
        return true;
      } catch {
        /* fall through to web */
      }
    }
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title, text, url });
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    /* user cancelled / unavailable */
  }
  return false;
}

export async function shareDrugLink(opts: {
  canonicalId: string | number;
  name?: string;
}): Promise<boolean> {
  const url = drugDeepLink(opts.canonicalId);
  const title = opts.name || "Medicine Support Hub";
  return sharePayload(title, opts.name ? `${opts.name} — Medicine Support Hub` : title, url);
}

export async function shareRxLink(prescriptionId: string): Promise<boolean> {
  const url = rxDeepLink(prescriptionId);
  return sharePayload("Prescription", "Open prescription in Medicine Support Hub", url);
}

export async function shareInviteLink(ref: string): Promise<boolean> {
  const url = inviteDeepLink(ref);
  return sharePayload(
    "Join Medicine Support Hub",
    "You're invited to Medicine Support Hub",
    url,
  );
}

export { drugDeepLink, rxDeepLink, inviteDeepLink };
