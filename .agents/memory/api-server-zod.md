---
name: API server zod import
description: How to import zod in the api-server package (esbuild bundling constraint)
---

The api-server uses esbuild to bundle everything. `zod/v4` sub-path cannot be resolved by esbuild. Always use `import { z } from "zod"` (not `zod/v4`) in api-server routes.

**Why:** esbuild's node bundling does not follow package.json `exports` sub-paths for `zod/v4` the same way Node does.

**How to apply:** When adding new routes that need validation, use plain `import { z } from "zod"` and ensure `zod` is listed in `artifacts/api-server/package.json` dependencies (it is, as of June 2026, using `"zod": "catalog:"`).
