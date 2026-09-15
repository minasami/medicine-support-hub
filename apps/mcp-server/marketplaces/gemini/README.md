# Medicine Support Hub — Gemini CLI extension

The canonical gallery extension files are at the repository root: `gemini-extension.json` and `GEMINI.md`. This directory remains a synchronized monorepo copy for the MCP marketplace package.

**Extension version:** `0.3.1`
**MCP endpoint:** `https://mcp.medicinesupport.app/mcp` (Streamable HTTP, OAuth 2.1 for authenticated tools)

## Install

```bash
# Link the repository root during local development
gemini extensions link /path/to/medicine-support-hub

# Or install the public GitHub repository (the manifest is at its root)
gemini extensions install https://github.com/minasami/medicine-support-hub.git

# One-liner MCP setup without installing the extension
gemini mcp add --transport http msh https://mcp.medicinesupport.app/mcp
```

Run `/mcp auth medicine-support-hub` when an authenticated account or request tool needs OAuth. Medical and privacy guidance lives in `GEMINI.md`.
