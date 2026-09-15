# MCP marketplace packages

Cross-ecosystem packaging for the Medicine Support Hub remote MCP server.

| Ecosystem | Package | Discovery file |
|---|---|---|
| Grok / xAI | `grok/medicine-support-hub/` | repo `.grok-plugin/marketplace.json` |
| ChatGPT / Codex | `openai/medicine-support-hub/` (mirrored at `plugins/medicine-support-hub/`) | `.agents/plugins/marketplace.json` |
| Claude Code | `claude/medicine-support-hub/` | `.claude-plugin/marketplace.json` |
| Gemini CLI | `gemini/` (`gemini-extension.json` + `GEMINI.md`) | install by path / git |

Preferred MCP URL: `https://mcp.medicinesupport.app/mcp`

Publish steps: [`docs/MCP_MARKETPLACE_PUBLISH.md`](../../../docs/MCP_MARKETPLACE_PUBLISH.md)
