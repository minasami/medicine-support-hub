# Medicine Support Hub — Gemini CLI extension

Files in this folder are the extension root (`gemini-extension.json` + `GEMINI.md`).

## Install

```bash
# Link from a local checkout (best for monorepos)
gemini extensions link "$(pwd)/apps/mcp-server/marketplaces/gemini"

# Or copy into the user extensions dir
mkdir -p ~/.gemini/extensions/medicine-support-hub
cp gemini-extension.json GEMINI.md ~/.gemini/extensions/medicine-support-hub/

# Git install with subdirectory (CLI builds that support --subpath)
gemini extensions install https://github.com/minasami/medicine-support-hub.git \
  --subpath apps/mcp-server/marketplaces/gemini
```

## One-liner MCP (no extension)

```bash
gemini mcp add --transport http msh https://mcp.medicinesupport.app/mcp
```

Topic guidance lives in `GEMINI.md`.
