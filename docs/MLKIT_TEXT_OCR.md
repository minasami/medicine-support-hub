# On-device ML Kit text OCR

Used by Scan → Prescription and Scan → Invoice **before** `ocr-prescription-parser`.

Web and browsers skip the plugin and keep server OCR only. Native recognition is loaded via dynamic import in `apps/web/src/lib/native-mlkit-text.ts` and fails soft when the plugin is absent.

## Capacitor note

`@capacitor-mlkit/text-recognition` currently publishes **8.x only** (Capacitor 8). This app is on Capacitor 6, so the package is **not** a hard dependency. Optional install when upgrading Cap:

```bash
pnpm add @capacitor-mlkit/text-recognition@^8 @capacitor/filesystem@^6
npx cap sync android
```

Optional AndroidManifest meta-data so Play preloads the OCR model:

```xml
<meta-data
  android:name="com.google.mlkit.vision.DEPENDENCIES"
  android:value="ocr" />
```
