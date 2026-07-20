// scripts/build-android-bundle.mjs
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const projectRoot = process.cwd();
const androidDir = path.join(projectRoot, "android");
const keystorePath = path.join(androidDir, "app", "release.keystore");
const gradlePropertiesPath = path.join(androidDir, "gradle.properties");

console.log("🚀 Starting Android Release App Bundle (.aab) Build...");

// Step 1: Ensure Web Build
console.log("📦 Building Web Application...");
execSync("pnpm run build", { stdio: "inherit" });

// Step 2: Sync Capacitor Android
console.log("🔄 Syncing Capacitor Android Container...");
if (!fs.existsSync(androidDir)) {
  console.log("📱 Initializing Android Platform...");
  execSync("npx cap add android", { stdio: "inherit" });
} else {
  execSync("npx cap sync android", { stdio: "inherit" });
}

// Step 3: Check / Generate Keystore for Signing
if (!fs.existsSync(keystorePath)) {
  console.log("🔑 Generating Release Keystore...");
  const keystoreCmd = `keytool -genkey -v -keystore "${keystorePath}" -alias medicine-support-hub-alias -keyalg RSA -keysize 2048 -validity 10000 -storepass MedicineHub2026 -keypass MedicineHub2026 -dname "CN=Medicine Support Hub, OU=Mobile, O=Medicine Support Hub, L=Cairo, S=Cairo, C=EG"`;
  try {
    execSync(keystoreCmd, { stdio: "inherit" });
    console.log("✅ Release Keystore generated successfully.");
  } catch (err) {
    console.warn("⚠️ keytool command failed or not found in PATH. You can manually generate a keystore or configure signed builds in Android Studio.");
  }
}

// Step 4: Configure Gradle Signing Properties if keystore exists
if (fs.existsSync(keystorePath)) {
  let gradleProps = fs.existsSync(gradlePropertiesPath) ? fs.readFileSync(gradlePropertiesPath, "utf-8") : "";
  if (!gradleProps.includes("RELEASE_STORE_FILE")) {
    const signingProps = `
RELEASE_STORE_FILE=release.keystore
RELEASE_STORE_PASSWORD=MedicineHub2026
RELEASE_KEY_ALIAS=medicine-support-hub-alias
RELEASE_KEY_PASSWORD=MedicineHub2026
`;
    fs.appendFileSync(gradlePropertiesPath, signingProps);
    console.log("⚙️ Configured Gradle signing properties.");
  }
}

// Step 5: Build Bundle (.aab)
console.log("🔨 Compiling Android App Bundle (.aab)...");
const isWindows = process.platform === "win32";
const gradlew = isWindows ? "gradlew.bat" : "./gradlew";

try {
  execSync(`${gradlew} bundleRelease`, { cwd: androidDir, stdio: "inherit" });
  
  const aabPath = path.join(androidDir, "app", "build", "outputs", "bundle", "release", "app-release.aab");
  if (fs.existsSync(aabPath)) {
    console.log("\n🎉 SUCCESS! Android App Bundle (.aab) created:");
    console.log(`📍 ${aabPath}`);
    console.log("\n👉 You can now upload this .aab file directly to your Google Play Console!");
  } else {
    console.log("\n📱 Build finished. Check android/app/build/outputs/bundle/release/ for output.");
  }
} catch (err) {
  console.warn("⚠️ Gradle build requires Android SDK & Java (JDK 17+) installed. You can also open the 'android' directory in Android Studio to build the bundle visually!");
}
