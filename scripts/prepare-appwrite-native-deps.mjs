import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const repositoryRoot = process.cwd();
const nodeModules = path.join(repositoryRoot, "node_modules");
const pnpmStore = path.join(nodeModules, ".pnpm");
const rootRequire = createRequire(pathToFileURL(path.join(repositoryRoot, "package.json")).href);

function isLinuxX64Musl() {
  if (process.platform !== "linux" || process.arch !== "x64") return false;
  try {
    const report = process.report?.getReport?.();
    if (report?.header?.glibcVersionRuntime) return false;
  } catch {
    // ignore
  }
  // Appwrite open-runtimes builders are musl; treat unknown linux x64 as candidate
  return true;
}

function encodedStorePrefix(packageName) {
  return `${packageName.replace("/", "+")}@`;
}

async function fromPnpmStore(packageName) {
  try {
    const entries = await fs.readdir(pnpmStore);
    const prefix = encodedStorePrefix(packageName);
    const matches = entries.filter((value) => value.startsWith(prefix)).sort();

    for (const entry of matches) {
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
        // try next
      }
    }
  } catch {
    // no .pnpm store
  }
  return null;
}

async function fromNodeResolve(packageName) {
  const candidates = [
    path.join(repositoryRoot, "package.json"),
    path.join(repositoryRoot, "apps", "web", "package.json"),
    path.join(repositoryRoot, "node_modules", "vite", "package.json"),
    path.join(repositoryRoot, "node_modules", "rollup", "package.json"),
  ];

  for (const base of candidates) {
    try {
      await fs.access(base);
      const req = createRequire(base);
      const resolved = req.resolve(`${packageName}/package.json`);
      const packageJson = JSON.parse(await fs.readFile(resolved, "utf8"));
      if (packageJson.version) {
        return {
          version: packageJson.version,
          packageRoot: path.dirname(resolved),
          resolverFile: resolved,
        };
      }
    } catch {
      // next
    }
  }

  try {
    const resolved = rootRequire.resolve(`${packageName}/package.json`);
    const packageJson = JSON.parse(await fs.readFile(resolved, "utf8"));
    if (packageJson.version) {
      return {
        version: packageJson.version,
        packageRoot: path.dirname(resolved),
        resolverFile: resolved,
      };
    }
  } catch {
    // ignore
  }

  return null;
}

async function fromPnpmList(packageName) {
  const result = spawnSync(
    "pnpm",
    ["list", packageName, "--json", "--depth", "0", "-r"],
    { encoding: "utf8", cwd: repositoryRoot },
  );
  if (result.status !== 0 || !result.stdout?.trim()) return null;
  try {
    const data = JSON.parse(result.stdout);
    const projects = Array.isArray(data) ? data : [data];
    for (const proj of projects) {
      const deps = {
        ...(proj.dependencies || {}),
        ...(proj.devDependencies || {}),
      };
      const hit = deps[packageName];
      if (hit?.version) {
        return {
          version: String(hit.version).replace(/^[^\d]*/, "") || hit.version,
          packageRoot: nodeModules,
          resolverFile: path.join(repositoryRoot, "package.json"),
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/** Optional fallbacks if resolution fails — prefer real installed versions. */
const FALLBACK_VERSIONS = {
  rollup: "4.60.3",
  "@tailwindcss/oxide": "4.3.0",
  lightningcss: "1.32.0",
};

async function installedPackageInfo(packageName) {
  const found =
    (await fromPnpmStore(packageName)) ||
    (await fromNodeResolve(packageName)) ||
    (await fromPnpmList(packageName));

  if (found) {
    console.log(`Resolved ${packageName}@${found.version}`);
    return found;
  }

  const fallback = FALLBACK_VERSIONS[packageName];
  if (fallback) {
    console.warn(
      `Could not locate ${packageName} in the install graph; using fallback ${fallback}.`,
    );
    return {
      version: fallback,
      packageRoot: nodeModules,
      resolverFile: path.join(repositoryRoot, "package.json"),
    };
  }

  return null;
}

function resolvePackage(packageName, resolverFile) {
  try {
    return createRequire(resolverFile).resolve(packageName);
  } catch {
    try {
      return rootRequire.resolve(packageName);
    } catch {
      return null;
    }
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

    console.log(
      `Materialized ${packageName}@${version} for the Appwrite musl build (${destination}).`,
    );
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

if (!isLinuxX64Musl()) {
  console.log("Appwrite musl native dependency preparation is not required on this runtime.");
  process.exit(0);
}

const specs = [
  ["rollup", "@rollup/rollup-linux-x64-musl"],
  ["@tailwindcss/oxide", "@tailwindcss/oxide-linux-x64-musl"],
  ["lightningcss", "lightningcss-linux-x64-musl"],
];

let anyFailed = false;
for (const [baseName, nativeName] of specs) {
  try {
    const info = await installedPackageInfo(baseName);
    if (!info) {
      console.warn(`Skipping ${nativeName}: could not resolve ${baseName}.`);
      continue;
    }
    await installNativePackage(nativeName, info.version, info.resolverFile);
  } catch (err) {
    anyFailed = true;
    console.warn(
      `Native package materialization warning for ${nativeName}: ${err.message || err}`,
    );
  }
}

// Never fail the Site build solely because optional musl binaries could not be forced;
// Vite may still resolve optional deps from the lockfile / optionalDependencies.
if (anyFailed) {
  console.warn(
    "One or more musl native packages could not be materialized; continuing build.",
  );
}

process.exit(0);
