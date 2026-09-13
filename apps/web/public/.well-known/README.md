# App Links / Universal Links

- `assetlinks.json` — Android App Links for `com.medicinesupporthub.app`
  - SHA-256 is the **upload keystore** fingerprint from `/workspace/play-signing/KEYSTORE_INFO.txt`.
  - If Play App Signing is enabled, also add the **App signing key certificate** SHA-256 from Play Console → App integrity.
- `apple-app-site-association` — iOS stub; replace `TEAMID` with the Apple Developer Team ID before enabling Associated Domains.

Serve both at `https://medicinesupport.app/.well-known/` without redirects (Appwrite Sites / static hosting).
