# Native notifications (Capacitor)

## Product split

| Surface | Permission / enable path | Delivery |
|--------|---------------------------|----------|
| **Web / PWA** | `Notification.requestPermission()` + VAPID PushManager (`pwa-experience.tsx`) | Existing web-push / Supabase RPC |
| **Native Android / iOS** | Single path: brief in-app rationale → `@capacitor/local-notifications` `requestPermissions` (POST_NOTIFICATIONS). Open app notification settings via `capacitor-native-settings` when denied | Device permission now; **FCM/APNs remote push deferred** until `google-services.json` / APNs keys are wired (`REMOTE_PUSH_CONFIGURED`) |

## Multi-prompt / close-on-Allow (fixed in 1.0.17)

**Root cause:** 1.0.16 called `LocalNotifications.requestPermissions()` then `tryRegisterNativePush()` → `PushNotifications.requestPermissions()` + `PushNotifications.register()`. That stacked a second system dialog and could kill the Activity when FCM/`google-services.json` was missing. Permission grant can also recreate the Activity; without a pending-flow marker the WebView looked like the app “closed”.

**Fix:** LocalNotifications only for permission; never call `PushNotifications.requestPermissions`; skip `register()` until `REMOTE_PUSH_CONFIGURED`; persist enable-flow + restore sheet/success on resume.

## Wiring FCM later

1. Add `android/app/google-services.json` (Play / Firebase project for `com.medicinesupporthub.app`).
2. Ensure `com.google.gms.google-services` applies (already gated in `android/app/build.gradle`).
3. Set `REMOTE_PUSH_CONFIGURED = true` in `apps/web/src/lib/native-notifications.ts`.
4. `tryRegisterNativePush()` will then receive a token — persist it to Appwrite/backend when hooks exist.
5. Rebuild AAB after `npx cap sync android`.

## Verify on device

1. Account / floating bell → bottom sheet.
2. Enable → **one** brief rationale → **one** system permission prompt (not two/three).
3. Allow → app stays open on the notifications sheet with success copy (device on; cloud push deferred).
4. Denied path → “device settings” copy + **Open App settings** (never “browser settings”).
5. Web browser path unchanged (browser copy + VAPID).
