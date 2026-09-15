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
| `apps/mcp-server/marketplaces/gemini/` | Gemini CLI extension |

---

## What is automated in this repo vs what Mina must submit

| Platform | Automated / in-repo | Mina must do in a console / upstream |
|---|---|---|
| **Grok (this repo)** | Marketplace + plugin + `.mcp.json` + skill | Users can install from `minasami/medicine-support-hub` once PR is merged |
| **Grok (xAI official catalog)** | Patch JSON prepared under `apps/mcp-server/marketplaces/patches/` | Fork `xai-org/plugin-marketplace`, pin SHA, regenerate index, open PR |
| **ChatGPT / Codex (local / repo marketplace)** | `.agents/plugins/marketplace.json` + `plugins/medicine-support-hub/` | Open ChatGPT desktop Plugins Directory and install from the repo marketplace; or `codex plugin marketplace add` |
| **ChatGPT / Codex (public universal directory)** | Package files ready | OpenAI Platform → plugin submission portal → Apps Management write + identity verify → Submit With MCP → Publish after approval |
| **Claude Code** | `.claude-plugin/marketplace.json` + plugin | Users: `claude plugin marketplace add minasami/medicine-support-hub` then install |
| **Gemini CLI** | `gemini-extension.json` + `GEMINI.md` | Users install from local path / git; optional listing on geminicli.com/extensions if Google publishes a catalog entry |

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
gemini extensions link /path/to/medicine-support-hub/apps/mcp-server/marketplaces/gemini

# Or install from git if your CLI supports --subpath
gemini extensions install https://github.com/minasami/medicine-support-hub.git --subpath apps/mcp-server/marketplaces/gemini

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
   - Auth: none for Phase 1 public tools (document clearly)
   - Complete domain verification: host token at  
     `https://mcp.medicinesupport.app/.well-known/openai-apps-challenge`  
     (or allowed parent origin)
   - Scan Tools → review tool metadata / annotations (`readOnlyHint`, `openWorldHint`, `destructiveHint`)
7. Add starter prompts + ≥5 positive and ≥3 negative test cases.
8. Attest policies → **Submit for Review**.
9. After approval, Mina clicks **Publish** (approval does not auto-publish).

Do **not** submit an existing integration ID; submit the MCP URL from scratch.

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

Extension root: `apps/mcp-server/marketplaces/gemini/`

- `gemini-extension.json` — uses `httpUrl` for Streamable HTTP (compatible with current and older Gemini CLI schemas). Newer CLIs also accept `"url"` + `"type": "http"`.
- `GEMINI.md` — topic guidance / tool rules.

Install paths:

```bash
gemini extensions link /abs/path/to/apps/mcp-server/marketplaces/gemini
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
  "apps/mcp-server/marketplaces/gemini/gemini-extension.json",
  "apps/mcp-server/marketplaces/patches/xai-org-plugin-marketplace-entry.json",
  "plugins/medicine-support-hub/plugin.json",
]
for p in roots:
  json.loads(pathlib.Path(p).read_text())
  print("OK", p)
PY

# Health (may 403 from bot-filtered networks; try from a browser or Vercel dashboard)
curl -fsS https://mcp.medicinesupport.app/health || true
curl -fsS https://msh-mcp.vercel.app/health || true
```

---

## After each MCP server release

1. Bump `version` in plugin manifests to match `apps/mcp-server/package.json`.
2. Keep MCP URL on `https://mcp.medicinesupport.app/mcp`.
3. For xAI official catalog: bump pinned `sha` and regenerate `plugin-index.json`.
4. For OpenAI public listing: Scan Tools again and submit a new version if tool schemas change.
