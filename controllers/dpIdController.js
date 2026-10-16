import DpId from "../models/DpId.js";
import fs from "fs/promises";
import path from "path";

// Upload DP IDs from file
export const uploadDpIds = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileContent = req.file.buffer ? req.file.buffer.toString("utf-8") : (await fs.readFile(req.file.path, "utf-8"));

    // Split by newlines and filter empty lines
    const rawLines = fileContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (rawLines.length === 0) {
      return res.status(400).json({ message: "File is empty or invalid" });
    }

    // Check if file has header/trailer (e.g., header starting with H~ or first line not a 16-digit ID)
    let targetLines = rawLines;
    const firstLineId = rawLines[0].split("~")[0].trim();
    const hasHeader =
      rawLines.length >= 3 &&
      (!/^\d{16}$/.test(firstLineId) || rawLines[0].startsWith("H~"));

    if (hasHeader) {
      // Ignore first line (header) and last line (trailer)
      targetLines = rawLines.slice(1, -1);
    }

    // Extract 16-digit DP IDs from lines (taking first part before ~ if present)
    const dpIds = targetLines
      .map((line) => line.split("~")[0].trim())
      .filter((id) => /^\d{16}$/.test(id));

    if (dpIds.length === 0) {
      return res.status(400).json({ message: "No valid 16-digit DP IDs found in file" });
    }

    // Remove duplicates within the file itself
    const uniqueDpIds = [...new Set(dpIds)];
    const fileDuplicateCount = dpIds.length - uniqueDpIds.length;

    // Find existing DP IDs in DB
    const existingDpIds = await DpId.find({
      dpId: { $in: uniqueDpIds },
    }).select("dpId");
    
    const existingDpIdSet = new Set(existingDpIds.map((d) => d.dpId));

    // Filter out existing IDs
    const newDpIds = uniqueDpIds.filter((id) => !existingDpIdSet.has(id));
    const dbDuplicateCount = uniqueDpIds.length - newDpIds.length;

    // Prepare documents for bulk insert
    const docsToInsert = newDpIds.map((id) => ({
      dpId: id,
      is_used: false,
    }));

    // Bulk insert
    if (docsToInsert.length > 0) {
      await DpId.insertMany(docsToInsert, { ordered: false });
    }

    const addedCount = docsToInsert.length;
    const totalDuplicateCount = fileDuplicateCount + dbDuplicateCount;

    res.status(200).json({
      success: true,
      message: "DP IDs processed successfully",
      data: {
        totalProcessed: dpIds.length,
        added: addedCount,
        duplicates: totalDuplicateCount,
        fileDuplicates: fileDuplicateCount,
        dbDuplicates: dbDuplicateCount,
      },
    });
  } catch (error) {
    console.error("Error uploading DP IDs:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get DP ID stats (total, used, free)
export const getFreeDpIdCount = async (req, res) => {
  try {
    const total = await DpId.countDocuments({});
    const used = await DpId.countDocuments({ is_used: true });
    const free = await DpId.countDocuments({ is_used: false });

    res.status(200).json({
      success: true,
      data: {
        total,
        used,
        free,
      },
      message: "DP ID statistics fetched successfully",
    });
  } catch (error) {
    console.error("Error getting free DP ID count:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};
