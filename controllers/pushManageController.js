import User from "../models/User.js";
import { pushToSharePro } from "./pushShareProController.js";
import { pushToNSE } from "./pushNSEController.js";
import { pushToBSE_MFI } from "./pushBseMfiController.js";
import { uploadBse } from "./uploadBseController.js";
import { pushKRA } from "./pushKRAController.js";
import { pushToCDSL } from "./pushCDSL.js";
import { isUserEligibleForCkyc } from "./pushCKYC.js";
import { decryptPayload } from "../utils/camsEncryption.js";

/**
 * Get push status summary for a user
 * Returns status and last log timestamp for each push section
 */
export const getAllPushStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }


    const pushStatusSummary = {};
    const pushTo = user.pushTo ? user.pushTo.toObject() : {};

    // Iterate over each key in pushTo (e.g., bseStar, camsKraUpload, etc.)
    for (const [key, value] of Object.entries(pushTo)) {
      if (value && typeof value === "object" && "status" in value) {
        let lastTimestamp = null;

        if (Array.isArray(value.logs) && value.logs.length > 0) {
          const lastLog = value.logs[value.logs.length - 1];
          lastTimestamp = lastLog.timestamp || null;
        }

        pushStatusSummary[key] = {
          status: value.status,
          liveStatus: value.liveStatus || "",
          message: value.message,
          lastTimestamp: lastTimestamp,
        };
      }
    }

    return res.status(200).json({
      success: true,
      data: pushStatusSummary,
      kycType: user.kycType,
      clientCode: user.clientCode,
      referredBy: user.referredBy,
    });
  } catch (error) {
    console.error("Error fetching push status summary:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get logs for a specific push section
 */
export const getPushLogsBySection = async (req, res) => {
  try {
    const { userId, section } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.pushTo || !user.pushTo[section]) {
      return res.status(404).json({
        success: false,
        message: `Push section '${section}' not found or no data available`,
      });
    }

    const sectionData = user.pushTo[section];
    let rawLogs = sectionData.logs ? [...sectionData.logs].reverse() : [];

    if (section === "camsKraUpload") {
      rawLogs = rawLogs.map((log) => {
        const logObj = typeof log.toObject === "function" ? log.toObject() : { ...log };
        if (logObj.response && typeof logObj.response === "object" && typeof logObj.response.data === "string") {
          try {
            logObj.response = decryptPayload(logObj.response.data);
          } catch (e) {
            // Keep original if decrypt fails
          }
        }
        return logObj;
      });
    }

    return res.status(200).json({
      success: true,
      section: section,
      status: sectionData.status,
      logs: rawLogs,
    });
  } catch (error) {
    console.error(`Error fetching logs for section ${req.params.section}:`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Execute push to all backoffice downstream systems
 */
export const pushAll = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const results = {};

    const createMockRes = () => {
      let statusCode = 200;
      let jsonResult = null;
      return {
        status(code) { statusCode = code; return this; },
        json(data) { jsonResult = data; return this; },
        send(data) { jsonResult = data; return this; },
        get result() { return { statusCode, jsonResult }; }
      };
    };

    // 1. SharePro / Client Master
    if (user.pushTo?.pushToClientMaster?.status !== "success") {
      try {
        const mockRes = createMockRes();
        await pushToSharePro(req, mockRes);
        results.pushToClientMaster = mockRes.result;
      } catch (err) {
        results.pushToClientMaster = { statusCode: 500, jsonResult: { message: err.message } };
      }
    } else {
      results.pushToClientMaster = { statusCode: 200, jsonResult: { message: "Already successfully pushed" } };
    }

    // 2. NSE
    if (user.pushTo?.uploadToNSE?.status !== "success") {
      try {
        const mockRes = createMockRes();
        await pushToNSE(req, mockRes);
        results.uploadToNSE = mockRes.result;
      } catch (err) {
        results.uploadToNSE = { statusCode: 500, jsonResult: { message: err.message } };
      }
    } else {
      results.uploadToNSE = { statusCode: 200, jsonResult: { message: "Already successfully pushed" } };
    }

    // 3. Upload to BSE (BSE Registration)
    if (user.pushTo?.uploadToBSE?.status !== "success") {
      try {
        const mockRes = createMockRes();
        await uploadBse(req, mockRes);
        results.uploadToBSE = mockRes.result;
      } catch (err) {
        results.uploadToBSE = { statusCode: 500, jsonResult: { message: err.message } };
      }
    } else {
      results.uploadToBSE = { statusCode: 200, jsonResult: { message: "Already successfully pushed" } };
    }

    // 4. BSE MFI / Star
    if (user.pushTo?.bseMfStar?.status !== "success") {
      try {
        const mockRes = createMockRes();
        await pushToBSE_MFI(req, mockRes);
        results.bseMfStar = mockRes.result;
      } catch (err) {
        results.bseMfStar = { statusCode: 500, jsonResult: { message: err.message } };
      }
    } else {
      results.bseMfStar = { statusCode: 200, jsonResult: { message: "Already successfully pushed" } };
    }

    // 5. KRA
    if (user.pushTo?.camsKraUpload?.status !== "success") {
      try {
        const mockRes = createMockRes();
        await pushKRA(req, mockRes);
        results.camsKraUpload = mockRes.result;
      } catch (err) {
        results.camsKraUpload = { statusCode: 500, jsonResult: { message: err.message } };
      }
    } else {
      results.camsKraUpload = { statusCode: 200, jsonResult: { message: "Already successfully pushed" } };
    }

    // 6. CDSL / DP
    if (user.pushTo?.uploadToDP?.status !== "success") {
      try {
        const mockRes = createMockRes();
        await pushToCDSL(req, mockRes);
        results.uploadToDP = mockRes.result;
      } catch (err) {
        results.uploadToDP = { statusCode: 500, jsonResult: { message: err.message } };
      }
    } else {
      results.uploadToDP = { statusCode: 200, jsonResult: { message: "Already successfully pushed" } };
    }

    // Return updated status summary
    const updatedUser = await User.findById(userId);
    const pushStatusSummary = {};
    const pushTo = updatedUser.pushTo ? updatedUser.pushTo.toObject() : {};

    for (const [key, value] of Object.entries(pushTo)) {
      if (value && typeof value === "object" && "status" in value) {
        let lastTimestamp = null;
        if (Array.isArray(value.logs) && value.logs.length > 0) {
          lastTimestamp = value.logs[value.logs.length - 1].timestamp || null;
        }
        pushStatusSummary[key] = {
          status: value.status,
          lastTimestamp: lastTimestamp,
        };
      }
    }

    return res.status(200).json({
      success: true,
      message: "Push all operations completed",
      results,
      data: pushStatusSummary,
    });
  } catch (error) {
    console.error("Error in pushAll:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
