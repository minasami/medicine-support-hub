#!/usr/bin/env node
/** Local MCP transport: LSP-style Content-Length framing on stdin/stdout. */
import { handleRpc } from "./rpc.mjs";

let buf = Buffer.alloc(0);

function writeMessage(obj) {
  const payload = Buffer.from(JSON.stringify(obj), "utf8");
  process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
  process.stdout.write(payload);
}

async function consume() {
  while (true) {
    const headerEnd = buf.indexOf("\r\n\r\n");
    if (headerEnd < 0) return;
    const header = buf.slice(0, headerEnd).toString("utf8");
    const m = /Content-Length:\s*(\d+)/i.exec(header);
    if (!m) {
      buf = buf.slice(headerEnd + 4);
      continue;
    }
    const len = Number(m[1]);
    const start = headerEnd + 4;
    if (buf.length < start + len) return;
    const raw = buf.slice(start, start + len).toString("utf8");
    buf = buf.slice(start + len);
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      writeMessage({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }
    const out = await handleRpc(msg);
    if (out != null) writeMessage(out);
  }
}

process.stdin.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  consume().catch((err) => {
    writeMessage({ jsonrpc: "2.0", id: null, error: { code: -32000, message: err.message || "stdio error" } });
  });
});

process.stdin.on("end", () => process.exit(0));
