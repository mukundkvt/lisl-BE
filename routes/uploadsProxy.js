import express from "express";
import path from "path";
import fs from "fs";
import { getObjectFromMinio, statObjectFromMinio } from "../utils/minioClient.js";

const router = express.Router();

const MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

/**
 * Custom backend proxy route to stream files from MinIO.
 * Any request to GET /uploads/... will fetch from MinIO bucket and stream to browser.
 */
router.use(async (req, res) => {
  try {
    const rawPath = req.path;
    const objectName = decodeURIComponent(rawPath).replace(/^[/\\]+/, "");
    
    if (!objectName) {
      return res.status(400).json({ error: "File path required" });
    }

    const defaultContentType = getMimeType(objectName);

    // Try MinIO first
    try {
      const stat = await statObjectFromMinio(objectName);
      const contentType = stat.metaData?.["content-type"] || stat.metaData?.["Content-Type"] || defaultContentType;

      res.setHeader("Content-Type", contentType);
      if (stat.size) {
        res.setHeader("Content-Length", stat.size);
      }
      res.setHeader("Cache-Control", "public, max-age=86400");

      const stream = await getObjectFromMinio(objectName);
      stream.pipe(res);
      return;
    } catch (minioErr) {
      // MinIO object not found, try local disk fallback for legacy files
      const localFilePath = path.join(process.cwd(), "uploads", objectName.replace(/^uploads\//, ""));
      if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
        res.setHeader("Content-Type", defaultContentType);
        return res.sendFile(localFilePath);
      }
      
      console.warn(`[UploadsProxy] File not found in MinIO or local disk: ${objectName}`);
      return res.status(404).json({ error: "File not found" });
    }
  } catch (err) {
    console.error("[UploadsProxy] Stream error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error fetching file" });
    }
  }
});

export default router;
