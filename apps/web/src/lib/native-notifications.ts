/**
 * Capacitor-native notification helpers.
 *
 * Web/PWA keeps Notification + PushManager + VAPID in pwa-experience.tsx.
 * Native Android/iOS uses LocalNotifications for the sole permission path
 * (POST_NOTIFICATIONS / equivalent). PushNotifications.register() is only
 * attempted when remote push is configured (google-services.json / APNs) —
 * never request Push permission after Local, and never crash if FCM is absent.
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
/** Persists enable UX across Android activity recreate on permission grant. */
export const NATIVE_ENABLE_FLOW_KEY = "msh_native_notif_enable_flow";

/**
 * Flip to true only after android/app/google-services.json (and iOS APNs) are
 * wired. Until then, never call PushNotifications.register() — it can kill
 * the activity without FCM.
 */
export const REMOTE_PUSH_CONFIGURED = false;

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

export type NativeEnableFlowSnapshot = {
  pending: boolean;
  showCenter: boolean;
  startedAt: number;
};

export function markNativeEnableFlowPending(showCenter = true) {
  try {
    const snapshot: NativeEnableFlowSnapshot = {
      pending: true,
      showCenter,
      startedAt: Date.now(),
    };
    localStorage.setItem(NATIVE_ENABLE_FLOW_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function clearNativeEnableFlow() {
  try {
    localStorage.removeItem(NATIVE_ENABLE_FLOW_KEY);
  } catch {
    /* ignore */
  }
}

export function readNativeEnableFlow(): NativeEnableFlowSnapshot | null {
  try {
    const raw = localStorage.getItem(NATIVE_ENABLE_FLOW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NativeEnableFlowSnapshot;
    if (!parsed?.pending) return null;
    // Ignore stale markers (>10 min)
    if (Date.now() - Number(parsed.startedAt || 0) > 10 * 60 * 1000) {
      clearNativeEnableFlow();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function mapDisplay(display: string | undefined): NativePermissionState {
  if (display === "granted") return "granted";
  if (display === "denied") return "denied";
  if (display === "prompt-with-rationale") return "prompt-with-rationale";
  return "prompt";
}

/** Sole permission path — LocalNotifications (no FCM required). */
export async function checkNativeNotificationPermission(): Promise<NativePermissionState> {
  if (!isNativePlatform()) return "denied";
  try {
    const status = await LocalNotifications.checkPermissions();
    return mapDisplay(status.display);
  } catch {
    return "prompt";
  }
}

/**
 * Request the single native notification permission (POST_NOTIFICATIONS on
 * Android 13+). Does not call PushNotifications.requestPermissions.
 */
export async function requestNativeNotificationPermission(): Promise<NativePermissionState> {
  if (!isNativePlatform()) return "denied";
  try {
    const status = await LocalNotifications.requestPermissions();
    return mapDisplay(status.display);
  } catch {
    return "denied";
  }
}

/**
 * Optional FCM/APNs registration. Safe when google-services.json is missing:
 * returns deferred without calling register() or requesting a second permission.
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
  if (!REMOTE_PUSH_CONFIGURED) {
    return { registered: false, deferred: true, error: "fcm_not_configured" };
  }

  try {
    // Permission already handled by LocalNotifications — never request again.
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      return { registered: false, deferred: true, error: "permission_not_granted" };
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
        void PushNotifications.removeAllListeners().catch(() => undefined);
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
