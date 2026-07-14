import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const repositoryRoot = process.cwd();
const nodeModules = path.join(repositoryRoot, "node_modules");
const pnpmStore = path.join(nodeModules, ".pnpm");
const requireFromRoot = createRequire(path.join(repositoryRoot, "package.json"));

function isLinuxX64Musl() {
  if (process.platform !== "linux" || process.arch !== "x64") return false;
  const report = process.report?.getReport?.();
  return !report?.header?.glibcVersionRuntime;
}

function encodedStorePrefix(packageName) {
  return `${packageName.replace("/", "+")}@`;
}

async function installedPackageVersion(packageName) {
  const entries = await fs.readdir(pnpmStore);
  const prefix = encodedStorePrefix(packageName);

  for (const entry of entries.filter((value) => value.startsWith(prefix)).sort()) {
    const packageJsonPath = path.join(
      pnpmStore,
      entry,
      "node_modules",
      ...packageName.split("/"),
      "package.json",
    );
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
      if (typeof packageJson.version === "string" && packageJson.version) {
        return packageJson.version;
      }
    } catch {
      // Keep checking matching pnpm store entries.
    }
  }

  throw new Error(`Could not determine the installed version of ${packageName}.`);
}

function packageIsResolvable(packageName) {
  try {
    requireFromRoot.resolve(packageName, { paths: [repositoryRoot] });
    return true;
  } catch {
    return false;
  }
}

async function installNativePackage(packageName, version) {
  if (packageIsResolvable(packageName)) {
    console.log(`${packageName} is already available.`);
    return;
  }

  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "medicine-support-appwrite-native-"),
  );

  try {
    await fs.writeFile(
      path.join(temporaryDirectory, "package.json"),
      JSON.stringify({ private: true }, null, 2),
      "utf8",
    );

    const result = spawnSync(
      "pnpm",
      [
        "--dir",
        temporaryDirectory,
        "add",
        "--ignore-scripts",
        "--config.lockfile=false",
        `${packageName}@${version}`,
      ],
      { encoding: "utf8", stdio: "pipe" },
    );

    if (result.status !== 0) {
      throw new Error(
        `Failed to install ${packageName}@${version}.\n${result.stdout || ""}\n${result.stderr || ""}`,
      );
    }

    const source = path.join(
      temporaryDirectory,
      "node_modules",
      ...packageName.split("/"),
    );
    const destination = path.join(nodeModules, ...packageName.split("/"));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.cp(source, destination, { recursive: true, force: true });
    console.log(`Installed ${packageName}@${version} for the Appwrite musl build.`);
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

if (!isLinuxX64Musl()) {
  console.log("Appwrite musl native dependency preparation is not required on this runtime.");
  process.exit(0);
}

const nativePackages = [
  ["@rollup/rollup-linux-x64-musl", await installedPackageVersion("rollup")],
  [
    "@tailwindcss/oxide-linux-x64-musl",
    await installedPackageVersion("@tailwindcss/oxide"),
  ],
  ["lightningcss-linux-x64-musl", await installedPackageVersion("lightningcss")],
];

for (const [packageName, version] of nativePackages) {
  await installNativePackage(packageName, version);
}
