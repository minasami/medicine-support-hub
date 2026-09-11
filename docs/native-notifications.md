# Native notifications (Capacitor)

## Product split

| Surface | Permission / enable path | Delivery |
|--------|---------------------------|----------|
| **Web / PWA** | `Notification.requestPermission()` + VAPID PushManager (`pwa-experience.tsx`) | Existing web-push / Supabase RPC |
| **Native Android / iOS** | `@capacitor/local-notifications` permission + Material rationale sheet; open app notification settings via `capacitor-native-settings` when denied | Device permission now; **FCM/APNs remote push deferred** until `google-services.json` / APNs keys are wired |

## Why WebView showed “browser settings”

Android WebView often reports `Notification.permission === "denied"` without a usable browser settings path. Native builds must not use that API for UX copy or enable.

## Wiring FCM later

1. Add `android/app/google-services.json` (Play / Firebase project for `com.medicinesupporthub.app`).
2. Ensure `com.google.gms.google-services` applies (already gated in `android/app/build.gradle`).
3. `tryRegisterNativePush()` in `apps/web/src/lib/native-notifications.ts` will then receive a token — persist it to Appwrite/backend when hooks exist.
4. Rebuild AAB after `npx cap sync android`.

## Verify on device

1. Account screen → tap floating bell → bottom sheet (not desktop popover).
2. Enable → rationale dialog → system permission prompt.
3. Denied path → “device settings” copy + **Open App settings** (never “browser settings”).
4. Web browser path unchanged (browser copy + VAPID).
