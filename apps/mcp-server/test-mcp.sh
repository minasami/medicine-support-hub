#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:8787}"
echo "== health =="
curl -sS "$BASE/health" | head -c 400; echo
echo "== tools/list =="
curl -sS "$BASE/mcp" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | head -c 600; echo
echo "== search Zurcal =="
curl -sS "$BASE/mcp" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_medicines","arguments":{"query":"Zurcal","limit":3}}}' | head -c 800; echo
echo "== estimate =="
curl -sS "$BASE/mcp" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"estimate_cost","arguments":{"lines":[{"query":"Zurcal","quantity":2},{"query":"Brufen","quantity":1}]}}}' | head -c 1200; echo
