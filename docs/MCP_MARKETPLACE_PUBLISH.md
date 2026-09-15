# MCP marketplace publish guide

Medicine Support Hub remote MCP packaging for AI plugin marketplaces (2026 layouts).

**Preferred MCP URL:** `https://mcp.medicinesupport.app/mcp`  
**Health:** `https://mcp.medicinesupport.app/health`  
**Aliases:** `https://msh-mcp.vercel.app/mcp` · legacy `https://medicine-support-hub-mcp.vercel.app/mcp`

Plugin packages live under `apps/mcp-server/marketplaces/`. Repo-root discovery files:

| File | Ecosystem |
|---|---|
| `.grok-plugin/marketplace.json` | Grok / xAI |
| `.agents/plugins/marketplace.json` | ChatGPT desktop + Codex |
| `.claude-plugin/marketplace.json` | Claude Code |
| `gemini-extension.json` + `GEMINI.md` | Gemini CLI extension |

---

## What is automated in this repo vs what Mina must submit

| Platform | Automated / in-repo | Mina must do in a console / upstream |
|---|---|---|
| **Grok (this repo)** | Marketplace + plugin + `.mcp.json` + skill | Users can install from `minasami/medicine-support-hub` once PR is merged |
| **Grok (xAI official catalog)** | Patch JSON prepared under `apps/mcp-server/marketplaces/patches/` | Fork `xai-org/plugin-marketplace`, pin SHA, regenerate index, open PR |
| **ChatGPT / Codex (local / repo marketplace)** | `.agents/plugins/marketplace.json` + `plugins/medicine-support-hub/` | Open ChatGPT desktop Plugins Directory and install from the repo marketplace; or `codex plugin marketplace add` |
| **ChatGPT / Codex (public universal directory)** | Package files ready | OpenAI Platform → plugin submission portal → Apps Management write + identity verify → Submit With MCP → Publish after approval |
| **Claude Code** | `.claude-plugin/marketplace.json` + plugin | Users: `claude plugin marketplace add minasami/medicine-support-hub` then install |
| **Gemini CLI** | Root `gemini-extension.json` + `GEMINI.md` | Public GitHub repo with the `gemini-cli-extension` topic is crawled automatically |

---

## User install one-liners

### Grok

```bash
# From this repo marketplace (after merge to main)
grok plugin marketplace add minasami/medicine-support-hub
grok plugin install medicine-support-hub --trust

# Direct MCP (no plugin package)
grok mcp add --transport http msh https://mcp.medicinesupport.app/mcp
```

### Claude Code

```bash
claude plugin marketplace add minasami/medicine-support-hub
claude plugin install medicine-support-hub@medicine-support-hub
```

Inside Claude Code:

```text
/plugin marketplace add minasami/medicine-support-hub
/plugin install medicine-support-hub@medicine-support-hub
```

### Codex / ChatGPT

```bash
# Codex CLI — add this repo as a marketplace source
codex plugin marketplace add minasami/medicine-support-hub

# Or clone and use the repo marketplace at .agents/plugins/marketplace.json
# then restart ChatGPT desktop → Plugins Directory → Medicine Support Hub
```

Developer Mode (MCP URL only):

1. ChatGPT → Settings → Security and login → Developer mode  
2. Plugins → + → MCP URL `https://mcp.medicinesupport.app/mcp`

### Gemini CLI

```bash
# Preferred: link the extension folder from a local checkout
gemini extensions link /path/to/medicine-support-hub

# Install from git; the manifest is at the repository root
gemini extensions install https://github.com/minasami/medicine-support-hub.git

# Direct MCP (no extension)
gemini mcp add --transport http msh https://mcp.medicinesupport.app/mcp
```

---

## 1. Grok / xAI

### In-repo (team / self-serve)

1. Merge this packaging PR so `.grok-plugin/marketplace.json` and `apps/mcp-server/marketplaces/grok/medicine-support-hub/` are on `main`.
2. Users add marketplace + install (see one-liners above).
3. Optional: validate with `grok plugin validate` if the CLI is installed.

### Official `xai-org/plugin-marketplace` (human PR)

Prepared entry: `apps/mcp-server/marketplaces/patches/xai-org-plugin-marketplace-entry.json`

Exact steps:

1. Ensure packaging is on `main`, then pin:
   ```bash
   git ls-remote https://github.com/minasami/medicine-support-hub.git HEAD
   ```
2. Fork https://github.com/xai-org/plugin-marketplace and branch from `main`.
3. Append the entry to `.grok-plugin/marketplace.json` → `plugins[]`, replacing `REPLACE_WITH_40_CHAR_COMMIT_SHA_AFTER_MERGE` with the full lowercase SHA.
4. Note: remote `source.path` is supported (see mongodb/railway/stripe entries). Keep  
   `"path": "apps/mcp-server/marketplaces/grok/medicine-support-hub"`.
5. Regenerate and validate (from the fork checkout):
   ```bash
   python3 scripts/generate-plugin-index.py
   python3 scripts/validate-catalog.py
   python3 scripts/generate-plugin-index.py --check
   ```
6. Open a PR following https://github.com/xai-org/plugin-marketplace/blob/main/CONTRIBUTING.md  
   Checklist: kebab-case unique name, pinned SHA, homepage, brand-scoped keywords/domains, license stated, index regenerated.
7. Wait for CI + code-owner review.

This agent cannot open that upstream PR from here unless Mina forks and grants write access to the fork.

---

## 2. ChatGPT + Codex

### Repo / personal marketplace (automated packaging)

- Catalog: `.agents/plugins/marketplace.json`
- Plugin mirror: `plugins/medicine-support-hub/` (portable `plugin.json` + `mcp.json`, plus `.codex-plugin/` compat)
- Source of truth copy: `apps/mcp-server/marketplaces/openai/medicine-support-hub/`

Test locally:

1. Open the repo in ChatGPT desktop Work / Codex, or run `codex plugin marketplace add minasami/medicine-support-hub`.
2. Restart ChatGPT desktop if needed.
3. Plugins Directory → marketplace **Medicine Support Hub** → install.
4. Confirm MCP tools attach and a catalog search works.

### Public universal Plugins Directory (Mina console)

Docs: https://developers.openai.com/plugins/deploy/submission

1. OpenAI Platform → organization that owns the listing.
2. Role permission **Apps Management = Write** for the submitter.
3. Complete individual or business **identity verification**.
4. Open the **plugin submission portal** → Create plugin → **With MCP**.
5. Info: name, short/long description, logo, category, website, support, privacy, terms (match verified identity).
6. MCP:
   - URL type: **Universal**
   - MCP Server URL: `https://mcp.medicinesupport.app/mcp`
   - **Auth: OAuth** for the account-capable listing. The current review submission still shows **No Auth**;
     when the next editable draft is available, switch it to OAuth before resubmitting.
   - Catalog-only option: a separate listing may keep **Auth: none** because public catalog tools remain anonymous;
     do not use that setting for the support/prescription/watchlist listing.
   - Complete domain verification (see **Domain challenge + DNS** below)
   - Scan Tools → review tool metadata / annotations (`readOnlyHint`, `openWorldHint`, `destructiveHint`)
7. Add starter prompts + ≥5 positive and ≥3 negative test cases.
8. Attest policies → **Submit for Review**.
9. After approval, Mina clicks **Publish** (approval does not auto-publish).

Do **not** submit an existing integration ID; submit the MCP URL from scratch.

### Domain challenge + DNS (`mcp.medicinesupport.app`)

OpenAI verifies ownership by fetching a plain-text token:

`https://mcp.medicinesupport.app/.well-known/openai-apps-challenge`

This repo serves that path from `apps/mcp-server` on Vercel:

1. In the OpenAI plugin / Apps portal, start domain verification and copy the **challenge TOKEN**.
2. Vercel → project that hosts MCP (aliases `mcp.medicinesupport.app` / `msh-mcp.vercel.app`) → **Settings → Environment Variables**:
   - Name: `OPENAI_APPS_CHALLENGE`
   - Value: the token (exact string, no quotes/newlines)
   - Environments: Production (and Preview if you test on a preview URL)
3. Redeploy the MCP project so the env is live.
4. DNS: `mcp.medicinesupport.app` should be a CNAME to the Vercel project (or the hostname Vercel shows under Domains). Confirm the custom domain is **Verified** in Vercel → Domains.
5. Confirm (from a normal browser or after WAF allow — see below):

```bash
curl -fsS https://mcp.medicinesupport.app/.well-known/openai-apps-challenge
# should print the token as plain text (Content-Type: text/plain)
```

Implementation notes:

- Handler: `apps/mcp-server/api/openai-apps-challenge.mjs`
- `vercel.json` rewrites **only** `/.well-known/openai-apps-challenge` → `/api/openai-apps-challenge` (no catch-all that would break other `/.well-known/*` paths)
- Local/Node server: same path is handled in `src/rpc.mjs` via `OPENAI_APPS_CHALLENGE`
- If the env is unset, the endpoint returns **404** with a short message (do not invent a fake token)

### Bot / WAF 403 on health checks (`x-vercel-mitigated: deny`)

Datacenter egress and some automated clients get **HTTP 403** with `x-vercel-mitigated: deny` from Vercel Attack Challenge / Bot Protection. That is **project firewall config**, not an application bug. Do **not** turn off all protection recklessly.

Recommended allow rules (Vercel → Firewall / Attack Challenge Mode):

1. Prefer **Custom** / challenge mode over a blanket deny for the MCP project if AI clients and OpenAI crawlers need unattended access.
2. Add allow / bypass rules for:
   - Path `/health` (uptime monitors)
   - Path `/.well-known/openai-apps-challenge` (OpenAI domain verify)
   - Path `/mcp` (MCP clients) if Challenge Mode blocks Streamable HTTP POSTs
3. If Cloudflare sits in front of the custom domain, create WAF exceptions for the same paths (or a known OpenAI / monitor UA allowlist). Keep rate limits.
4. Validate from a browser session and from the Vercel deployment logs / “Visit” link, not only from CI datacenter IPs.

`vercel.json` only adds mild security headers (`X-Content-Type-Options`, `Referrer-Policy`) and `Cache-Control: no-store` for health/challenge — it cannot disable Attack Challenge Mode.

---

## 3. Claude Code

Packaging is complete in-repo. After merge:

```bash
claude plugin marketplace add minasami/medicine-support-hub
claude plugin install medicine-support-hub@medicine-support-hub
claude plugin validate .   # from repo root, optional
```

No separate Anthropic “app store” console step is required for a third-party git marketplace. Optional: share the marketplace add command with partners; org admins may pin via `extraKnownMarketplaces` in managed settings.

---

## 4. Gemini CLI

Extension root: repository root (`/gemini-extension.json` + `/GEMINI.md`)

- `gemini-extension.json` — version `0.3.1`, using the current `url` + `type: "http"` Streamable HTTP fields and OAuth discovery.
- `GEMINI.md` — topic guidance / tool rules.

Install paths:

```bash
gemini extensions link /abs/path/to/medicine-support-hub
# or copy into ~/.gemini/extensions/medicine-support-hub/
```

Human optional: if Google’s public extension gallery accepts submissions, use the same folder; otherwise document the `gemini mcp add` one-liner for users.

---

## Pre-publish validation checklist

```bash
# JSON well-formed
python3 - <<'PY'
import json, pathlib, sys
roots = [
  ".grok-plugin/marketplace.json",
  ".grok-plugin/plugin-index.json",
  ".claude-plugin/marketplace.json",
  ".agents/plugins/marketplace.json",
  "apps/mcp-server/clients/mcp.json",
  "apps/mcp-server/marketplaces/grok/medicine-support-hub/.mcp.json",
  "apps/mcp-server/marketplaces/grok/medicine-support-hub/.grok-plugin/plugin.json",
  "apps/mcp-server/marketplaces/openai/medicine-support-hub/plugin.json",
  "apps/mcp-server/marketplaces/openai/medicine-support-hub/mcp.json",
  "apps/mcp-server/marketplaces/openai/medicine-support-hub/.mcp.json",
  "apps/mcp-server/marketplaces/openai/medicine-support-hub/.codex-plugin/plugin.json",
  "apps/mcp-server/marketplaces/claude/medicine-support-hub/.mcp.json",
  "apps/mcp-server/marketplaces/claude/medicine-support-hub/.claude-plugin/plugin.json",
  "gemini-extension.json",
  "apps/mcp-server/marketplaces/patches/xai-org-plugin-marketplace-entry.json",
  "plugins/medicine-support-hub/plugin.json",
]
for p in roots:
  json.loads(pathlib.Path(p).read_text())
  print("OK", p)
PY

# Health (may 403 when Vercel Attack Challenge / bot mitigation is on —
# see "Bot / WAF 403" above; try browser or Vercel dashboard Visit)
curl -fsS https://mcp.medicinesupport.app/health || true
curl -fsS https://msh-mcp.vercel.app/health || true
# Domain challenge (after OPENAI_APPS_CHALLENGE is set + redeploy)
curl -fsS https://mcp.medicinesupport.app/.well-known/openai-apps-challenge || true
```

---

## After each MCP server release

1. Bump `version` in plugin manifests to match `apps/mcp-server/package.json`.
2. Keep MCP URL on `https://mcp.medicinesupport.app/mcp`.
3. For xAI official catalog: bump pinned `sha` and regenerate `plugin-index.json`.
4. For OpenAI public listing: Scan Tools again and submit a new version if tool schemas change.


---

## OAuth 2.1 account tools (0.3.1)

Public catalog tools remain anonymous. Account tools (`whoami`, support / Rx / contributions / personal watchlist) require OAuth 2.1.

### Connect + login (ChatGPT / Grok / Claude / Codex / Gemini)

1. Point the connector at `https://mcp.medicinesupport.app/mcp`.
2. Use any public tool to verify the link.
3. Call a protected tool (e.g. `whoami`). The host should show a login / link account UI after receiving `_meta["mcp/www_authenticate"]` + protected-resource metadata.
4. Complete sign-in on `https://medicinesupport.app/mcp-oauth` with the existing Google / Appwrite session.
5. Retry the protected tool.

Details: [apps/mcp-server/docs/OAUTH.md](../apps/mcp-server/docs/OAUTH.md)

### Collection mapping

| Capability | Appwrite collection | Notes |
|---|---|---|
| Support / NGO personal request | `mcp_support_requests` | Web org NGO UI still uses Supabase `support_requests` |
| Prescription / pharmacy negotiation | `prescriptions` (+ `prescription_items`) | Binary upload via `/rx/upload` |
| Drug / catalog contribution | `drug_contributions` | Same as barcode wiki |
| Account watchlist / alerts | `user_watchlist` | Separate from global MCP `data/price-watchlist.json` |

Provision: `APPWRITE_API_KEY=... node scripts/provision-mcp-user-collections.mjs`

### Vercel env (MCP project)

| Name | Purpose |
|---|---|
| `MCP_OAUTH_SIGNING_SECRET` | HMAC for access/refresh/auth-code/DCR JWTs (min 16 chars) |
| `MCP_PUBLIC_URL` | `https://mcp.medicinesupport.app` |
| `MCP_RESOURCE_URI` | `https://mcp.medicinesupport.app/mcp` |
| `APPWRITE_ENDPOINT` | `https://fra.cloud.appwrite.io/v1` |
| `APPWRITE_PROJECT_ID` | `6a54ac3a00272c02d6e0` |
| `APPWRITE_DATABASE_ID` | `medicine_support_hub` |
| `APPWRITE_API_KEY` | Server key for user-scoped writes |
| `PUBLIC_SITE_URL` | `https://medicinesupport.app` |
| `OPENAI_APPS_CHALLENGE` | Unchanged domain verify token |

Optional: `APPWRITE_MCP_SUPPORT_COLLECTION_ID`, `APPWRITE_USER_WATCHLIST_COLLECTION_ID`, `MCP_OAUTH_ISSUER`.

For the ChatGPT public directory, the account-capable listing must use **Auth: OAuth** (not “none”). The current review submission is still **No Auth**; change the next editable draft to OAuth. A separate catalog-only listing may remain anonymous and must document that account tools require OAuth.
