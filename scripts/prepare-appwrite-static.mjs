import { promises as fs } from "node:fs";
import path from "node:path";

const repositoryRoot = process.cwd();
const appSourcePath = path.join(repositoryRoot, "apps/web/src/App.tsx");
const outputDirectory = path.join(repositoryRoot, "apps/web/dist/public");
const indexPath = path.join(outputDirectory, "index.html");

const [appSource, indexHtml] = await Promise.all([
  fs.readFile(appSourcePath, "utf8"),
  fs.readFile(indexPath, "utf8"),
]);

const routePattern = /<Route\s+path="([^"]+)"/g;
const routes = new Set();

for (const match of appSource.matchAll(routePattern)) {
  const route = match[1];
  if (route === "/" || route.includes(":") || route.includes("*")) continue;
  routes.add(route);
}

for (const route of [...routes].sort()) {
  const segments = route.split("/").filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Unsafe route discovered while preparing Appwrite output: ${route}`);
  }

  const routeDirectory = path.join(outputDirectory, ...segments);
  await fs.mkdir(routeDirectory, { recursive: true });
  await fs.writeFile(path.join(routeDirectory, "index.html"), indexHtml);
}

// Appwrite Sites does not provide Vercel-style path rewrites. This gives static
// hosts a conventional client-rendered not-found document for dynamic routes.
await fs.writeFile(path.join(outputDirectory, "404.html"), indexHtml);

console.log(`Prepared ${routes.size} static route entry points and 404.html for Appwrite Sites.`);
