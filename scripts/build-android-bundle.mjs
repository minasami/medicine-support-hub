// scripts/build-android-bundle.mjs
// Builds a signed Android App Bundle (.aab) for Google Play.
// Signing secrets must come from android/keystore.properties (gitignored)
// or env vars — never hardcode passwords in the repo.
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const projectRoot = process.cwd();
const androidDir = path.join(projectRoot, "android");
const keystorePropertiesPath = path.join(androidDir, "keystore.properties");
const examplePath = path.join(androidDir, "keystore.properties.example");

function requireSigningConfig() {
  const fromEnv = {
    storeFile: process.env.ANDROID_KEYSTORE_PATH,
    storePassword: process.env.ANDROID_KEYSTORE_PASSWORD,
    keyAlias: process.env.ANDROID_KEY_ALIAS,
    keyPassword: process.env.ANDROID_KEY_PASSWORD,
  };

  if (
    fromEnv.storeFile &&
    fromEnv.storePassword &&
    fromEnv.keyAlias &&
    fromEnv.keyPassword
  ) {
    // Write a local gitignored properties file for Gradle (paths relative to android/app).
    const storeFile = path.isAbsolute(fromEnv.storeFile)
      ? path.relative(path.join(androidDir, "app"), fromEnv.storeFile)
      : fromEnv.storeFile;
    const contents = [
      `storeFile=${storeFile}`,
      `storePassword=${fromEnv.storePassword}`,
      `keyAlias=${fromEnv.keyAlias}`,
      `keyPassword=${fromEnv.keyPassword}`,
      "",
    ].join("\n");
    fs.writeFileSync(keystorePropertiesPath, contents, { mode: 0o600 });
    console.log("Configured signing from environment variables → android/keystore.properties");
    return;
  }

  if (fs.existsSync(keystorePropertiesPath)) {
    console.log("Using existing android/keystore.properties for release signing.");
    return;
  }

  console.error(`
Missing release signing config.

1. Generate an upload keystore locally (once):
   keytool -genkey -v -keystore android/app/upload.keystore \\
     -alias medicine-support-hub -keyalg RSA -keysize 2048 -validity 10000

2. Copy ${examplePath} → ${keystorePropertiesPath}
   and fill storePassword / keyPassword (file is gitignored).

Or set env vars:
  ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD,
  ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD

Then re-run: pnpm mobile:build:android
`);
  process.exit(1);
}

console.log("Starting Android Release App Bundle (.aab) build...");

console.log("Building web application with BASE_PATH=./ for Capacitor assets...");
execSync("pnpm run build", {
  stdio: "inherit",
  env: { ...process.env, BASE_PATH: "./" },
});

console.log("Syncing Capacitor Android...");
if (!fs.existsSync(androidDir)) {
  console.log("Initializing Android platform...");
  execSync("npx cap add android", { stdio: "inherit" });
} else {
  execSync("npx cap sync android", { stdio: "inherit" });
}

requireSigningConfig();

console.log("Compiling Android App Bundle (.aab)...");
const isWindows = process.platform === "win32";
const gradlew = isWindows ? "gradlew.bat" : "./gradlew";

try {
  execSync(`${gradlew} bundleRelease`, { cwd: androidDir, stdio: "inherit" });

  const aabPath = path.join(
    androidDir,
    "app",
    "build",
    "outputs",
    "bundle",
    "release",
    "app-release.aab",
  );
  if (fs.existsSync(aabPath)) {
    console.log("\nSUCCESS — Android App Bundle created:");
    console.log(`  ${aabPath}`);
    console.log("\nUpload this .aab to Google Play Console (Internal testing first).");
  } else {
    console.log(
      "\nBuild finished. Check android/app/build/outputs/bundle/release/ for output.",
    );
  }
} catch (err) {
  console.error(
    "Gradle build failed. Need Android SDK + JDK 17+, or open the android/ folder in Android Studio and Build → Generate Signed Bundle.",
  );
  process.exit(1);
}
