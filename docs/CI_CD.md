# CI/CD Pipelines

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|--------|
| **CI** (`.github/workflows/ci.yml`) | PR + push `main` | pnpm install, typecheck, web build, function syntax checks |
| **CD Deploy** (`.github/workflows/cd-deploy.yml`) | push `main` + manual | Build gate → deploy Appwrite functions → Site redeploy hook |
| **Quality** | PR + push `main` | Legacy typecheck/build (kept for compatibility) |
| **Platform Health** | schedule / PR / main | Validate + production smoke + issue on failure |
| **Refresh ID map** | weekly + manual | Export Appwrite medicines → refresh static map |

## Required GitHub configuration

### Secrets

| Secret | Used by | Notes |
|--------|---------|--------|
| `APPWRITE_API_KEY` | CD, refresh-id-map | Server API key (rotate if exposed) |
| `APPWRITE_PROJECT_ID` | CD, refresh-id-map | e.g. `6a54ac3a00272c02d6e0` |
| `APPWRITE_SITE_DEPLOY_HOOK` | CD | Optional POST URL to force Site rebuild |

### Variables (optional)

| Variable | Default |
|----------|--------|
| `APPWRITE_ENDPOINT` | `https://fra.cloud.appwrite.io/v1` |
| `APPWRITE_DATABASE_ID` | `medicine_support_hub` |

## Appwrite Site deploy options

1. **Git integration (recommended)**  
   Appwrite Sites → connect `main` → auto-build on push (uses `build:appwrite` / your Site build command).

2. **Deploy hook**  
   Create a deploy hook in Appwrite Sites, store URL as `APPWRITE_SITE_DEPLOY_HOOK`. CD workflow POSTs after a green build gate.

3. **Manual**  
   Console → Sites → Redeploy.

## Local parity

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
# Appwrite Site-equivalent:
pnpm run build:appwrite
```

## Branch protection (recommended)

On `main`:

- Require status checks: **CI / Install · Typecheck · Build**
- Require branches to be up to date before merge
- No direct push for non-admins (optional)

## CD safety

- Function deploy **skips** if secrets are missing (does not fail the pipeline).
- Site redeploy **skips** if hook secret is missing.
- Clinical data and catalog rule promotion stay **human-gated** (`promote-approved-aliases.mjs`).
