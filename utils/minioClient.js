import * as Minio from "minio";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const endPoint = process.env.MINIO_ENDPOINT || "minio-ovw6gai9bqlf1iw6fqo3naxl.125.18.156.117.sslip.io";
const port = parseInt(process.env.MINIO_PORT || "443", 10);
const useSSL = process.env.MINIO_USE_SSL === "true" || process.env.MINIO_USE_SSL === true;
const accessKey = process.env.MINIO_ROOT_USER || "q6ale6tfTz0tDTne";
const secretKey = process.env.MINIO_ROOT_PASSWORD || "6YW1ZazvxbJWINGrpvfZvP99sf52Ss1D";
export const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || "lisl-kyc";

export const minioClient = new Minio.Client({
  endPoint,
  port,
  useSSL,
  accessKey,
  secretKey,
});

let isBucketChecked = false;

export async function ensureBucket() {
  if (isBucketChecked) return true;
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, "us-east-1");
      console.log(`[MinIO] Bucket '${BUCKET_NAME}' created successfully.`);
    }
    isBucketChecked = true;
    return true;
  } catch (error) {
    console.error(`[MinIO] Error checking/creating bucket '${BUCKET_NAME}':`, error.message);
    return false;
  }
}

/**
  * Upload a Buffer, File Path, or Stream to MinIO
  * @param {string} objectName - Name or path of the object inside MinIO (e.g. '172225_pan.png' or 'uploads/172225_pan.png')
  * @param {Buffer|string|ReadableStream} input - File content buffer or local file path
  * @param {string} contentType - MIME type (e.g., 'image/png', 'application/pdf')
  */
export async function uploadToMinio(objectName, input, contentType = "application/octet-stream") {
  await ensureBucket();

  // Normalize objectName (strip leading slashes or 'uploads/' if we want clean key names)
  const cleanKey = objectName.replace(/^[/\\]+/, "");

  let buffer;
  if (typeof input === "string") {
    // If input is a local file path
    buffer = await fs.promises.readFile(input);
  } else if (Buffer.isBuffer(input)) {
    buffer = input;
  } else {
    buffer = input;
  }

  const metaData = {
    "Content-Type": contentType,
  };

  await minioClient.putObject(BUCKET_NAME, cleanKey, buffer, buffer.length, metaData);
  console.log(`[MinIO] Uploaded '${cleanKey}' (${buffer.length} bytes, ${contentType})`);

  return {
    bucket: BUCKET_NAME,
    key: cleanKey,
    // Database relative path format (e.g., "/uploads/filename.ext")
    relativePath: cleanKey.startsWith("uploads/") ? `/${cleanKey}` : cleanKey.startsWith("/") ? cleanKey : `/uploads/${cleanKey}`,
  };
}

/**
  * Get object stream from MinIO for serving files via backend server
  */
export async function getObjectFromMinio(objectName) {
  await ensureBucket();
  const cleanKey = objectName.replace(/^[/\\]+/, "");
  
  // Try cleanKey first, then try with 'uploads/' or without 'uploads/'
  try {
    return await minioClient.getObject(BUCKET_NAME, cleanKey);
  } catch (err) {
    if (cleanKey.startsWith("uploads/")) {
      const trimmed = cleanKey.replace(/^uploads\//, "");
      return await minioClient.getObject(BUCKET_NAME, trimmed);
    } else {
      return await minioClient.getObject(BUCKET_NAME, `uploads/${cleanKey}`);
    }
  }
}

/**
  * Get stat (metadata) of an object
  */
export async function statObjectFromMinio(objectName) {
  await ensureBucket();
  const cleanKey = objectName.replace(/^[/\\]+/, "");
  try {
    return await minioClient.statObject(BUCKET_NAME, cleanKey);
  } catch (err) {
    if (cleanKey.startsWith("uploads/")) {
      const trimmed = cleanKey.replace(/^uploads\//, "");
      return await minioClient.statObject(BUCKET_NAME, trimmed);
    } else {
      return await minioClient.statObject(BUCKET_NAME, `uploads/${cleanKey}`);
    }
  }
}

/**
  * Delete object from MinIO
  */
export async function deleteFromMinio(objectName) {
  await ensureBucket();
  const cleanKey = objectName.replace(/^[/\\]+/, "");
  try {
    await minioClient.removeObject(BUCKET_NAME, cleanKey);
    console.log(`[MinIO] Deleted '${cleanKey}'`);
  } catch (err) {
    console.error(`[MinIO] Failed to delete '${cleanKey}':`, err.message);
  }
}

/**
 * Helper to fetch a file buffer directly from MinIO or local disk
 */
export async function getFileBufferFromMinio(objectNameOrPath) {
  if (!objectNameOrPath) return null;
  const cleanKey = objectNameOrPath.replace(/^[/\\]+/, "").replace(/^(\.\/)+/, "");

  // Check local disk first
  const localPath = path.isAbsolute(objectNameOrPath)
    ? objectNameOrPath
    : path.join(process.cwd(), cleanKey.startsWith("uploads/") ? cleanKey : `uploads/${cleanKey}`);

  if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
    return await fs.promises.readFile(localPath);
  }

  // Fetch from MinIO
  try {
    const stream = await getObjectFromMinio(cleanKey);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    console.error(`[MinIO] Failed to getFileBuffer for '${objectNameOrPath}':`, err.message);
    return null;
  }
}

