import http from "node:http";
import { handleHttp } from "./rpc.mjs";

const PORT = Number(process.env.PORT || 8787);
const MCP_PATH = process.env.MCP_PATH || "/mcp";

http.createServer((req, res) => {
  handleHttp(req, res).catch((err) => {
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message || "internal error" }));
    }
  });
}).listen(PORT, () => {
  console.log(`MSH MCP Phase 1 listening on :${PORT}${MCP_PATH}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});
