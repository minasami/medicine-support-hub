# Google Play launch checklist — Medicine Support Hub

**Package ID:** `com.medicinesupporthub.app`  
**Live web:** https://medicinesupport.app  
**Privacy:** https://medicinesupport.app/privacy  
**Contact:** minasamitawfiksaad@gmail.com  
**Capacitor fix:** merged in PR #149 (`main`)

## A. Local signed AAB (on your machine)

```bash
git pull origin main
keytool -genkey -v -keystore android/app/upload.keystore \
  -alias medicine-support-hub -keyalg RSA -keysize 2048 -validity 10000
cp android/keystore.properties.example android/keystore.properties
# Fill storePassword / keyPassword; set storeFile=upload.keystore
pnpm mobile:build:android
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

Never commit `*.keystore`, `*.jks`, or `keystore.properties`.

## B. Play Console — create app

1. https://play.google.com/console → Create app
2. Name: **Medicine Support Hub** / العربية: **مركز دعم الأدوية**
3. Default language: English (United States) — add Arabic locale after
4. App / Free / complete declarations

## C. Store listing

Copy from [`LISTING.md`](./LISTING.md). Upload:

| Asset | File |
|---|---|
| App icon 512×512 | `play-icon-512.png` (generated for Console) |
| Feature graphic 1024×500 | `play-feature-graphic-1024x500.png` |
| Phone screenshots (≥2) | Capture after internal install |

Category: **Medical**. Website: https://medicinesupport.app

## D. App content (required for production; partial OK for internal)

- [ ] Privacy policy URL
- [ ] Ads: No (unless you enable ads)
- [ ] Content rating questionnaire (IARC)
- [ ] Target audience / age
- [ ] News app: No
- [ ] COVID-19 contact tracing / status: No
- [ ] Data safety — see [`DATA_SAFETY.md`](./DATA_SAFETY.md)

## E. Internal testing release

1. Release → Testing → Internal testing → Create new release
2. Enable Play App Signing (default)
3. Upload `app-release.aab`
4. Release name: `1.0 (1)` matching `versionName` / `versionCode`
5. Testers → email list → add yourself → open join link on device

## F. Smoke on device

- [ ] App opens (not blank WebView)
- [ ] Search a medicine
- [ ] Open a company profile (not Soul Pharma fallback)
- [ ] Sign-in / account if used
- [ ] Capture ≥2 screenshots for the listing

## G. Then

Closed testing → Production when listing + data safety + content rating are complete.
