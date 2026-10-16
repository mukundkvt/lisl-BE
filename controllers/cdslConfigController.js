import CdslConfig from "../models/CdslConfig.js";
import { getISTDate } from "../utils/convertToIndianTimeDate.js";

/**
 * Get CDSL Configuration (Strictly from Database)
 */
export const getCdslConfig = async (req, res) => {
  try {
    const config = await CdslConfig.findOne()
      .populate("updatedBy", "name role email")
      .populate("updateHistory.updatedBy", "name role email");

    return res.status(200).json({
      success: true,
      data: config || null,
    });
  } catch (error) {
    console.error("💥 Error fetching CDSL config:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch CDSL configuration",
      error: error.message,
    });
  }
};

/**
 * Update CDSL Configuration
 */
export const updateCdslConfig = async (req, res) => {
  try {
    const {
      dpId,
      userId,
      password,
      aesKey,
      referer,
      authUrl,
      uploadUrl,
      statusUrl,
      downloadUrl,
      modifyUrl,
    } = req.body;

    if (
      !dpId ||
      !userId ||
      !password ||
      !aesKey ||
      !referer ||
      !authUrl ||
      !uploadUrl ||
      !statusUrl ||
      !downloadUrl ||
      !modifyUrl
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required to configure CDSL DP.",
      });
    }

    const istDate = getISTDate(new Date());
    let config = await CdslConfig.findOne().sort({ createdAt: -1 });

    if (config) {
      // Save snapshot in updateHistory
      const previousData = {
        dpId: config.dpId,
        userId: config.userId,
        password: config.password,
        aesKey: config.aesKey,
        referer: config.referer,
        authUrl: config.authUrl,
        uploadUrl: config.uploadUrl,
        statusUrl: config.statusUrl,
        downloadUrl: config.downloadUrl,
        modifyUrl: config.modifyUrl,
      };

      if (!config.updateHistory) {
        config.updateHistory = [];
      }

      config.updateHistory.push({
        updatedBy: req.user?.userId || req.user?._id,
        updatedAt: istDate,
        previousData,
      });

      config.dpId = String(dpId).trim();
      config.userId = String(userId).trim();
      config.password = String(password).trim();
      config.aesKey = String(aesKey).trim();
      config.referer = String(referer).trim();
      config.authUrl = String(authUrl).trim();
      config.uploadUrl = String(uploadUrl).trim();
      config.statusUrl = String(statusUrl).trim();
      config.downloadUrl = String(downloadUrl).trim();
      config.modifyUrl = String(modifyUrl).trim();
      config.updatedBy = req.user?.userId || req.user?._id;
      config.updatedAt = istDate;

      await config.save();
    } else {
      config = await CdslConfig.create({
        dpId: String(dpId).trim(),
        userId: String(userId).trim(),
        password: String(password).trim(),
        aesKey: String(aesKey).trim(),
        referer: String(referer).trim(),
        authUrl: String(authUrl).trim(),
        uploadUrl: String(uploadUrl).trim(),
        statusUrl: String(statusUrl).trim(),
        downloadUrl: String(downloadUrl).trim(),
        modifyUrl: String(modifyUrl).trim(),
        updatedBy: req.user?.userId || req.user?._id,
        createdAt: istDate,
        updatedAt: istDate,
      });
    }

    const populated = await CdslConfig.findById(config._id).populate(
      "updatedBy",
      "name role email"
    );

    return res.status(200).json({
      success: true,
      message: "CDSL DP credentials updated successfully in database",
      data: populated,
    });
  } catch (error) {
    console.error("💥 Error updating CDSL config:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update CDSL DP credentials",
      error: error.message,
    });
  }
};
