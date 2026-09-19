# iOS Mac setup — Medicine Support Hub

**Run these steps only on macOS with Xcode.**  
Linux / Cloud Agents cannot produce a valid `ios/` tree or App Store archive.  
Do **not** run `npx cap add ios` on Linux if it fails or would leave a broken partial tree — document and stop (this guide is the Mac path).

**Prerequisites**

- macOS + Xcode (current stable) + command-line tools
- CocoaPods (`sudo gem install cocoapods` or Homebrew)
- Node 20+ and **pnpm** (repo uses `packageManager: pnpm@11.x`)
- Apple Developer team membership
- Bundle ID: `com.medicinesupporthub.app` (matches `capacitor.config.ts` `appId`)

**ML Kit:** `@capacitor-mlkit/barcode-scanning` requires **iOS 15.5+** and camera permission. See [`docs/capacitor-shell.md`](../capacitor-shell.md) and [`docs/mlkit-barcode-scanning.md`](../mlkit-barcode-scanning.md).

---

## Exact commands

From the repo root (clean `main` or your release branch):

```bash
# 1. Dependencies + web build (Capacitor webDir: apps/web/dist/public)
pnpm install
pnpm run build

# 2. Add iOS platform ONCE (creates ios/)
npx cap add ios
# equivalently: pnpm mobile:add:ios

# 3. Raise deployment target for ML Kit (edit ios/App/Podfile)
#    Set the first platform line to:
#    platform :ios, '15.5'
```

Edit `ios/App/Podfile` so it contains:

```ruby
platform :ios, '15.5'
```

Then set **Minimum Deployments → 15.5** on the App target in Xcode (step 6).

```bash
# 4. Camera usage string for barcode scan (Info.plist)
#    Add key NSCameraUsageDescription, e.g.:
#    "Medicine Support Hub uses the camera to scan medicine barcodes."
```

You can add the key with Xcode (App target → Info → Custom iOS Target Properties) or by editing `ios/App/App/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>Medicine Support Hub uses the camera to scan medicine barcodes.</string>
```

```bash
# 5. Sync native project with web build + plugins
pnpm mobile:sync
# or: npx cap sync ios

# 6. Open in Xcode
npx cap open ios
# or: open ios/App/App.xcworkspace
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → your Team; confirm Bundle Identifier `com.medicinesupporthub.app`
2. **General / Minimum Deployments:** **iOS 15.5**
3. Confirm `NSCameraUsageDescription` is present
4. Product → Destination: **Any iOS Device** → **Product → Archive**
5. Organizer → **Distribute App** → App Store Connect → Upload
6. In App Store Connect / TestFlight, wait for processing, then attach the build to a version and submit

Optional CocoaPods refresh after Podfile change:

```bash
cd ios/App && pod install && cd ../..
npx cap sync ios
```

---

## Appwrite (same day as first native build)

Appwrite Console → Platforms → add **iOS** with bundle id `com.medicinesupporthub.app`.  
See [`CHECKLIST.md`](./CHECKLIST.md) §7.

---

## What not to do on Linux / this agent

```bash
# Do NOT run on Linux CI or non-Mac agents:
npx cap add ios
```

If that command errors or creates an incomplete `ios/` directory, delete the broken tree only on the machine that created it, and use a Mac instead. Prefer leaving `ios/` out of git until a Mac has generated a healthy project (or commit a Mac-generated tree deliberately in a follow-up PR).

For a reminder without building, from any OS:

```bash
pnpm mobile:build:ios
```

---

## Related

- Listing copy: [`LISTING.md`](./LISTING.md)
- Full ASC checklist: [`CHECKLIST.md`](./CHECKLIST.md)
- Play Store twin: [`docs/play-store/`](../play-store/)
