import { Router } from "express";
import path from "path";
import fs from "fs";
import { logger } from "../lib/logger";

const router = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");

router.get("/uploads/:filename", (req, res) => {
  const safeName = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(uploadsDir, safeName);

  if (!fs.existsSync(filePath)) {
    void logger;
    res.status(404).json({ error: "File not found" });
    return;
  }

  const ext = path.extname(safeName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".pdf": "application/pdf",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  const contentType = mimeTypes[ext] ?? "application/octet-stream";
  res.setHeader("Content-Type", contentType);
  fs.createReadStream(filePath).pipe(res);
});

export default router;
