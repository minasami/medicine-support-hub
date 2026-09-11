/**
 * Capacitor-native notification helpers.
 *
 * Web/PWA keeps Notification + PushManager + VAPID in pwa-experience.tsx.
 * Native Android/iOS uses LocalNotifications for permission (works without FCM)
 * and optionally PushNotifications.register() when google-services / APNs exist.
 */
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import {
  AndroidSettings,
  IOSSettings,
  NativeSettings,
} from "capacitor-native-settings";

export type NativePermissionState =
  | "prompt"
  | "prompt-with-rationale"
  | "granted"
  | "denied";

const NATIVE_ENABLED_KEY = "msh_native_notifications_enabled";

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function wasNativeNotificationsEnabled(): boolean {
  try {
    return localStorage.getItem(NATIVE_ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setNativeNotificationsEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(NATIVE_ENABLED_KEY, "1");
    else localStorage.removeItem(NATIVE_ENABLED_KEY);
  } catch {
    /* ignore */
  }
}

function mapDisplay(display: string | undefined): NativePermissionState {
  if (display === "granted") return "granted";
  if (display === "denied") return "denied";
  if (display === "prompt-with-rationale") return "prompt-with-rationale";
  return "prompt";
}

/** Prefer LocalNotifications — does not require FCM/google-services.json. */
export async function checkNativeNotificationPermission(): Promise<NativePermissionState> {
  if (!isNativePlatform()) return "denied";
  try {
    const status = await LocalNotifications.checkPermissions();
    return mapDisplay(status.display);
  } catch {
    try {
      const status = await PushNotifications.checkPermissions();
      return mapDisplay(status.receive);
    } catch {
      return "prompt";
    }
  }
}

export async function requestNativeNotificationPermission(): Promise<NativePermissionState> {
  if (!isNativePlatform()) return "denied";
  try {
    const status = await LocalNotifications.requestPermissions();
    return mapDisplay(status.display);
  } catch {
    try {
      const status = await PushNotifications.requestPermissions();
      return mapDisplay(status.receive);
    } catch {
      return "denied";
    }
  }
}

/**
 * Attempt FCM/APNs registration. Safe to call without google-services.json —
 * failures are returned as deferred (permission UX still succeeded).
 */
export async function tryRegisterNativePush(): Promise<{
  registered: boolean;
  deferred: boolean;
  token?: string;
  error?: string;
}> {
  if (!isNativePlatform()) {
    return { registered: false, deferred: true, error: "not_native" };
  }
  try {
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      const asked = await PushNotifications.requestPermissions();
      if (asked.receive !== "granted") {
        return { registered: false, deferred: false, error: "permission_denied" };
      }
    }

    return await new Promise((resolve) => {
      let settled = false;
      const finish = (result: {
        registered: boolean;
        deferred: boolean;
        token?: string;
        error?: string;
      }) => {
        if (settled) return;
        settled = true;
        void PushNotifications.removeAllListeners();
        resolve(result);
      };

      const timer = window.setTimeout(() => {
        finish({
          registered: false,
          deferred: true,
          error: "registration_timeout",
        });
      }, 8000);

      void PushNotifications.addListener("registration", (token) => {
        window.clearTimeout(timer);
        finish({
          registered: true,
          deferred: false,
          token: token.value,
        });
      });

      void PushNotifications.addListener("registrationError", (err) => {
        window.clearTimeout(timer);
        finish({
          registered: false,
          deferred: true,
          error: String(err?.error || "registration_error"),
        });
      });

      void PushNotifications.register().catch((cause) => {
        window.clearTimeout(timer);
        finish({
          registered: false,
          deferred: true,
          error: cause instanceof Error ? cause.message : String(cause),
        });
      });
    });
  } catch (cause) {
    return {
      registered: false,
      deferred: true,
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
}

export async function openNativeNotificationSettings(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const result = await NativeSettings.open({
      optionAndroid: AndroidSettings.AppNotification,
      optionIOS: IOSSettings.App,
    });
    return Boolean(result?.status);
  } catch {
    try {
      // Fallback: app details (user can open Notifications from there)
      const result = await NativeSettings.open({
        optionAndroid: AndroidSettings.ApplicationDetails,
        optionIOS: IOSSettings.App,
      });
      return Boolean(result?.status);
    } catch {
      return false;
    }
  }
}
