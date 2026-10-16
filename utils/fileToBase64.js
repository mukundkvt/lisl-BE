import fs from "fs";
import { getFileBufferFromMinio } from "./minioClient.js";

export async function fileToBase64(filePath) {
  if (!filePath) return "";

  try {
    const buffer = await getFileBufferFromMinio(filePath);
    if (buffer && buffer.length > 0) {
      return buffer.toString("base64");
    }
  } catch (e) {}

  try {
    if (fs.existsSync(filePath)) {
      const fileBuffer = fs.readFileSync(filePath);
      return fileBuffer.toString("base64");
    }
  } catch (e) {}

  return "";
}
