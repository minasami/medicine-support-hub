# App Store launch checklist — Medicine Support Hub

**Bundle ID:** `com.medicinesupporthub.app`  
**Live web:** https://medicinesupport.app  
**Privacy:** https://medicinesupport.app/privacy  
**Contact:** minasamitawfiksaad@gmail.com  
**Capacitor:** 6.x · ML Kit barcode requires **iOS 15.5+**  
**Repo note:** `android/` exists; **no `ios/` folder yet** — generate on a Mac (see [`IOS_MAC_SETUP.md`](./IOS_MAC_SETUP.md)).

Copy listing text from [`LISTING.md`](./LISTING.md).

---

## Blockers (do these before Archive / submit)

- [ ] **Apple Developer Program** membership active (paid team)
- [ ] **Mac** with Xcode (current stable) for `npx cap add ios`, CocoaPods, Archive, upload
- [ ] **App Store Connect** app record with bundle id `com.medicinesupporthub.app`
- [ ] **Appwrite** Console: register an **iOS** platform with the same bundle id (OAuth / deep links / SDK platform checks)

---

## 1. Apple Developer Program

1. Enroll or renew at https://developer.apple.com/programs/
2. Confirm Team ID and that you can create identifiers / certificates
3. In Certificates, Identifiers & Profiles → Identifiers → register **App ID** `com.medicinesupporthub.app` (if not auto-created by ASC)

## 2. App Store Connect — create app

1. https://appstoreconnect.apple.com → My Apps → **+** → New App
2. Platforms: iOS
3. Name: **Medicine Support Hub** (EN); add العربية localization later
4. Primary language: English (U.S.)
5. Bundle ID: **`com.medicinesupporthub.app`** (must match Capacitor `appId`)
6. SKU: e.g. `medicine-support-hub-ios` (internal; not shown on store)
7. User Access: Full Access (or as your org requires)

## 3. Privacy policy URL

- [ ] App Information → Privacy Policy URL: `https://medicinesupport.app/privacy`
- [ ] Same URL in App Privacy questionnaire if asked

## 4. Age rating

- [ ] Complete the Age Rating questionnaire in App Store Connect
- [ ] Expect a mature / medical-information-adjacent rating as appropriate; no unrestricted web user content unless you declare otherwise
- [ ] Align answers with Play / actual app behavior (no gambling, no unrestricted social, etc.)

## 5. App Privacy (“nutrition labels”)

Declare data the app **collects** (not only what you process on-device). Typical candidates for this product (verify against live code and Appwrite):

| Likely type | Examples | Notes |
|-------------|----------|-------|
| Contact info | Email (account) | If sign-in is offered |
| Identifiers | User ID, device / install id | Appwrite session / analytics if any |
| Usage data | Product interaction | If analytics enabled |
| Diagnostics | Crash logs | If you ship crash reporting |
| Photos / Camera | Barcode scan | Camera for ML Kit scan — often “not linked to identity” if used only for scan |

- [ ] Fill App Privacy for each purpose (App Functionality, etc.)
- [ ] Update when you add SDKs (analytics, ads, push)

## 6. Screenshots & listing

Sizes commonly required (confirm current ASC UI):

| Device set | Common pixel size |
|------------|-------------------|
| iPhone 6.7" | 1290 × 2796 (or 1320 × 2868 on newer sets) |
| iPhone 6.5" | 1242 × 2688 (if still required) |

- [ ] Paste EN (+ AR) copy from [`LISTING.md`](./LISTING.md)
- [ ] Upload 1024×1024 icon (no alpha)
- [ ] ≥2–3 phone screenshots: catalog, product detail, companies, or `/scan`
- [ ] Support URL + Marketing URL: https://medicinesupport.app
- [ ] Category: **Medical**

## 7. Appwrite iOS platform registration

In Appwrite Console → your project → **Platforms** → **Add platform** → **Apple / iOS**:

- Name: e.g. `Medicine Support Hub iOS`
- Bundle ID: `com.medicinesupporthub.app`

Without this, client SDK calls or OAuth redirect rules that check platform may fail on the native shell even if Android already works.

Also confirm any OAuth redirect / deep-link schemes match what Capacitor / Appwrite expect once `ios/` exists.

## 8. Mac: generate iOS project, Archive, upload

Follow **[`IOS_MAC_SETUP.md`](./IOS_MAC_SETUP.md)** exactly (do **not** run `cap add ios` on Linux CI / this agent box).

- [ ] `pnpm install` → `pnpm run build` → `npx cap add ios`
- [ ] Podfile `platform :ios, '15.5'`
- [ ] `NSCameraUsageDescription` in Info.plist
- [ ] `pnpm mobile:sync` / `npx cap sync ios`
- [ ] Open Xcode → Signing & Capabilities (Team + unique bundle id)
- [ ] Product → Archive → Distribute App → App Store Connect
- [ ] Or: `xcodebuild` / Transporter upload of the IPA

## 9. TestFlight

1. ASC → TestFlight → wait for processing
2. Add internal testers (App Store Connect Users)
3. Optional external group → Beta App Review if required
4. Smoke on device:
   - [ ] App opens (not blank WKWebView)
   - [ ] Search a medicine
   - [ ] Open a company profile
   - [ ] Camera permission + barcode scan on `/scan`
   - [ ] Sign-in / account if used

## 10. Submit for review

- [ ] Select build in the iOS version
- [ ] Export compliance / encryption answers (standard HTTPS-only → usually “No” for non-exempt algorithms — answer truthfully)
- [ ] Advertising Identifier: No (unless you add ads/ATT)
- [ ] Review notes: mention camera used only for medicine barcode scanning; link privacy policy
- [ ] Submit for Review

## Do not commit

- Apple distribution certificates / `.p12` / private keys
- `AuthKey_*.p8` App Store Connect API keys
- Provisioning profiles with secrets
- Local `.env` with Appwrite API keys

Keep signing assets on the Mac keychain / CI secrets store only.
