# Android Google Play release

## Architecture

Package the production PWA as a Trusted Web Activity (TWA). This preserves the existing Supabase session, Appwrite-hosted frontend, deep links, responsive interface, and PWA update lifecycle.

Provisional application values:

```text
Application name: Medicine Support Hub
Package ID: app.medicinesupport.hub
Host: medicinesupport.app
Start URL: /medicines?source=android
Theme color: #0b1f33
Background color: #f8fafc
Display: standalone
```

## Build

Install Android Studio and a supported JDK, then install Bubblewrap and initialize from the production manifest:

```text
npm install --global @bubblewrap/cli
bubblewrap init --manifest=https://medicinesupport.app/manifest.webmanifest
bubblewrap doctor
bubblewrap build
```

Choose `app.medicinesupport.hub` when the wizard asks for a package identifier. Keep the generated keystore outside Git and back it up securely. Upload the generated `.aab` to a Google Play internal-testing track before any public release.

## Required domain verification

After creating the Play Console application:

1. Enable Play App Signing.
2. Copy the SHA-256 fingerprint for the **App signing key certificate**.
3. Copy `assetlinks.template.json` to `apps/web/public/.well-known/assetlinks.json`.
4. Replace the fingerprint placeholder with the exact Play signing fingerprint.
5. Deploy and verify `https://medicinesupport.app/.well-known/assetlinks.json`.
6. Test direct links to `/medicines`, `/jobs`, `/companies`, `/account`, and authorized workspaces.

Do not use the upload-key fingerprint as the only production fingerprint. Google Play signs distributed builds with the app-signing key.

## Release gates

- Homepage, medicines, jobs, companies, account, privacy, terms, and support pages load.
- Google and password sign-in return to the initiating route.
- The device back button navigates history without losing form state.
- File upload, camera/photo selection, location permission, notifications, and WhatsApp links are tested.
- Private clinical pages are not available offline.
- No server secret exists in the Android project or web bundle.
- Play Data Safety answers match actual platform behavior.
