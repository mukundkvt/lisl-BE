import express from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { uploadToMinio } from "../utils/minioClient.js";

const router = express.Router();

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf" || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and image files are allowed"), false);
    }
  },
}).fields([
  { name: "file", maxCount: 1 },
  { name: "fileName", maxCount: 1 },
  { name: "fileExtension", maxCount: 1 },
]);

router.post("/upload", upload, async (req, res) => {
  try {
    if (!req.files || !req.files.file || !req.files.file[0]) {
      throw new Error("No file uploaded");
    }

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) return res.status(404).json({ message: "User not found" });

    const file = req.files.file[0];
    const fileName = req.body.fileName || "document";
    const fileExtension = req.body.fileExtension || "pdf";

    const safeFileName = fileName.split(" ").join("_").replace(/[^a-z0-9_]/gi, "");
    const safeFileExtension = fileExtension.replace(/[^a-z0-9]/gi, "");
    
    const objectName = `uploads/${user.PAN || "unknown"}_${safeFileName}_${Date.now()}.${safeFileExtension}`;

    const uploaded = await uploadToMinio(objectName, file.buffer, file.mimetype || "application/pdf");

    res.status(200).json({ path: uploaded.relativePath, fileName, fileExtension });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(400).json({ message: error.message });
  }
});

export default router;
