import multer from "multer";

// Configure memory storage for streaming directly to MinIO
const storage = multer.memoryStorage();

export const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});
