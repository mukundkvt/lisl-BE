import fs from "fs/promises";
import { deleteFromMinio } from "./minioClient.js";

async function deleteIfExists(filePath) {
  try {
    if (!filePath) return;

    // Delete from MinIO
    try {
      await deleteFromMinio(filePath);
      console.log(`✅ [MinIO] Deleted object: ${filePath}`);
    } catch (minioErr) {
      console.error(`❌ [MinIO] Error deleting ${filePath}:`, minioErr.message);
    }

    // Also delete local file if it exists
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      console.log(`✅ [Local] Deleted file: ${filePath}`);
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error(`❌ [Local] Error deleting ${filePath}:`, err);
      }
    }
  } catch (err) {
    console.error(`❌ Error in deleteIfExists for ${filePath}:`, err);
  }
}

export default deleteIfExists;

