# On-device ML Kit text OCR

Used by Scan → Prescription and Scan → Invoice **before** `ocr-prescription-parser`.

## Install into the Android shell

From the repo root (Capacitor 6):

```bash
pnpm add @capacitor-mlkit/text-recognition@^6 @capacitor/filesystem@^6
npx cap sync android
```

Optional AndroidManifest meta-data so Play preloads the OCR model:

```xml
<meta-data
  android:name="com.google.mlkit.vision.DEPENDENCIES"
  android:value="ocr" />
```

Then rebuild the APK. Web and browsers skip the plugin and keep server OCR only.
