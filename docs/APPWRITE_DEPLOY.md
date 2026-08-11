# Appwrite deployment automation

## Recommended model

| Layer | How it deploys |
|-------|----------------|
| **Site (web app)** | Git connection on `main` **or** CD triggers `POST /sites/{id}/deployments/vcs` |
| **Functions** | CD uses Appwrite CLI (`push` / `create-deployment`) |
| **Databases / indexes** | Manual or one-off scripts (not every push) |

## One-time setup

### 1. GitHub secrets (you already have API key + project)

| Name | Required | Where to get it |
|------|----------|-----------------|
| `APPWRITE_API_KEY` | Yes | Console → Overview → Integrations → API keys |
| `APPWRITE_PROJECT_ID` | Yes | Console → Settings → Project ID |
| `APPWRITE_SITE_ID` | For API site redeploy | Console → **Sites** → your site → Settings → **Site ID** |

Optional variables:

| Name | Default |
|------|--------|
| `APPWRITE_ENDPOINT` | `https://fra.cloud.appwrite.io/v1` |
| `APPWRITE_SITE_BRANCH` | `main` |

### 2. Find your Site ID

```bash
export APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
export APPWRITE_PROJECT_ID=…
export APPWRITE_API_KEY=…
node scripts/appwrite-deploy.mjs --list-sites
```

Copy the `id=` value into GitHub secret **`APPWRITE_SITE_ID`**.

### 3. Connect Site to Git (still recommended)

**Sites → Settings → Git repository → Connect Git**  
Production branch: `main`  

Then every `git push origin main` builds automatically. CD’s VCS call is a **backup / force rebuild**.

## Workflows

| Workflow | Role |
|----------|------|
| `.github/workflows/ci.yml` | Typecheck + build on PR/`main` |
| `.github/workflows/cd-deploy.yml` | After green gate → Site VCS deploy + function deploy |

Manual run: **Actions → CD Deploy → Run workflow**.

## Local commands

```bash
# List resources
node scripts/appwrite-deploy.mjs --list-sites
node scripts/appwrite-deploy.mjs --list-functions

# Force production Site rebuild from branch main
export APPWRITE_SITE_ID=your_site_id
node scripts/appwrite-deploy.mjs --site
```

## Site build settings (Console)

Typical monorepo settings for this repo:

| Setting | Suggested value |
|---------|-----------------|
| Install | `corepack enable && pnpm install --frozen-lockfile` |
| Build | `pnpm run build:appwrite` or your Site’s existing command |
| Output | as configured for static/SSR (match current Site) |

If a deploy fails, open **Sites → Deployments → Logs**.

## What CD does *not* do

- Does not change clinical catalog rows
- Does not promote adaptive search aliases (human-gated)
- Does not rotate API keys

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Site job skips | Set `APPWRITE_SITE_ID` |
| VCS deploy 401/401 | API key needs Sites write scope |
| Function deploy WARN | Create function once in Console with matching `$id` from `appwrite.json` |
| Git auto-deploy not firing | Re-check Git connection + branch filters under Site settings |
