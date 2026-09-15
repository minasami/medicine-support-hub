# Upstream catalog patches

## xAI official marketplace (`xai-org/plugin-marketplace`)

This agent cannot open a PR on `xai-org/plugin-marketplace` unless Mina forks it and grants access.

1. Merge the Medicine Support Hub PR that adds `apps/mcp-server/marketplaces/grok/medicine-support-hub`.
2. Pin SHA:
   ```bash
   git ls-remote https://github.com/minasami/medicine-support-hub.git HEAD
   ```
3. Fork https://github.com/xai-org/plugin-marketplace
4. Append the object in `xai-org-plugin-marketplace-entry.json` (with real `sha`) to `.grok-plugin/marketplace.json` → `plugins[]`.
5. If the upstream schema rejects `path` on url sources, either:
   - vendor under `external_plugins/medicine-support-hub/` from our Grok plugin folder and use local source, **or**
   - publish a thin dedicated repo whose root *is* the Grok plugin and point `url` at that repo (no `path`).
6. Regenerate index and validate:
   ```bash
   python3 scripts/generate-plugin-index.py
   python3 scripts/validate-catalog.py
   python3 scripts/generate-plugin-index.py --check
   ```
7. Open PR per https://github.com/xai-org/plugin-marketplace/blob/main/CONTRIBUTING.md

See also `docs/MCP_MARKETPLACE_PUBLISH.md`.
