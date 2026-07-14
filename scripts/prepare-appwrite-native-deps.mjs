import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const repositoryRoot = process.cwd();
const nodeModules = path.join(repositoryRoot, "node_modules");
const pnpmStore = path.join(nodeModules, ".pnpm");

function isLinuxX64Musl() {
  if (process.platform !== "linux" || process.arch !== "x64") return false;
  const report = process.report?.getReport?.();
  return !report?.header?.glibcVersionRuntime;
}

function encodedStorePrefix(packageName) {
  return `${packageName.replace("/", "+")}@`;
}

async function installedPackageInfo(packageName) {
  const entries = await fs.readdir(pnpmStore);
  const prefix = encodedStorePrefix(packageName);

  for (const entry of entries.filter((value) => value.startsWith(prefix)).sort()) {
    const packageRoot = path.join(
      pnpmStore,
      entry,
      "node_modules",
      ...packageName.split("/"),
    );
    const packageJsonPath = path.join(packageRoot, "package.json");

    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
      if (typeof packageJson.version === "string" && packageJson.version) {
        return {
          version: packageJson.version,
          packageRoot,
          resolverFile: packageJsonPath,
        };
      }
    } catch {
      // Keep checking matching pnpm store entries.
    }
  }

  throw new Error(`Could not determine the installed version of ${packageName}.`);
}

function resolvePackage(packageName, resolverFile) {
  try {
    return createRequire(resolverFile).resolve(packageName);
  } catch {
    return null;
  }
}

async function installNativePackage(packageName, version, resolverFile) {
  const existingResolution = resolvePackage(packageName, resolverFile);
  if (existingResolution) {
    console.log(`${packageName} is already available at ${existingResolution}.`);
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

    // pnpm exposes dependencies in node_modules as symlinks into its virtual
    // store. Copying that symlink and then deleting the temporary directory
    // leaves a broken package. Resolve the link first and copy the real files.
    const sourceLink = path.join(
      temporaryDirectory,
      "node_modules",
      ...packageName.split("/"),
    );
    const source = await fs.realpath(sourceLink);
    const destination = path.join(nodeModules, ...packageName.split("/"));

    await fs.rm(destination, { recursive: true, force: true });
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.cp(source, destination, {
      recursive: true,
      force: true,
      dereference: true,
    });

    const installedManifest = JSON.parse(
      await fs.readFile(path.join(destination, "package.json"), "utf8"),
    );
    if (installedManifest.version !== version) {
      throw new Error(
        `Materialized ${packageName}, but expected ${version} and found ${installedManifest.version}.`,
      );
    }

    const resolved = resolvePackage(packageName, resolverFile);
    if (!resolved) {
      throw new Error(
        `Materialized ${packageName}@${version}, but it is still not resolvable from ${resolverFile}.`,
      );
    }

    console.log(
      `Materialized and verified ${packageName}@${version} for the Appwrite musl build (${resolved}).`,
    );
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

if (!isLinuxX64Musl()) {
  console.log("Appwrite musl native dependency preparation is not required on this runtime.");
  process.exit(0);
}

const rollup = await installedPackageInfo("rollup");
const oxide = await installedPackageInfo("@tailwindcss/oxide");
const lightningcss = await installedPackageInfo("lightningcss");

const nativePackages = [
  ["@rollup/rollup-linux-x64-musl", rollup.version, rollup.resolverFile],
  [
    "@tailwindcss/oxide-linux-x64-musl",
    oxide.version,
    oxide.resolverFile,
  ],
  [
    "lightningcss-linux-x64-musl",
    lightningcss.version,
    lightningcss.resolverFile,
  ],
];

for (const [packageName, version, resolverFile] of nativePackages) {
  await installNativePackage(packageName, version, resolverFile);
}
