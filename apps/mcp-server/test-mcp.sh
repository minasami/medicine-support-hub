#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:8787}"
echo "== health =="
curl -sS "$BASE/health"; echo
echo "== initialize (streamable HTTP) =="
curl -sS "$BASE/mcp" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -H 'MCP-Protocol-Version: 2025-03-26' -d '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}'; echo
echo "== tools/list =="
curl -sS "$BASE/mcp" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'; echo
echo "== search Zurcal =="
curl -sS "$BASE/mcp" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_medicines","arguments":{"query":"Zurcal","limit":3}}}'; echo
