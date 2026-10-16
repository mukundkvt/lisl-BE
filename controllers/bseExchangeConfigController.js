import BseExchangeConfig from "../models/BseExchangeConfig.js";
import { getISTDate } from "../utils/convertToIndianTimeDate.js";

// Get Current BSE Exchange Config
export const getBseExchangeConfig = async (req, res) => {
  try {
    const config = await BseExchangeConfig.findOne()
      .sort({ createdAt: -1 })
      .populate("updatedBy", "name role");

    if (!config) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "BSE Exchange configuration not found",
      });
    }

    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    console.error("Error fetching BSE Exchange Config:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Update or Create BSE Exchange Config
export const updateBseExchangeConfig = async (req, res) => {
  try {
    const {
      memberId,
      userId,
      password,
      uccVersion = "CLIENTDETAILS_V5",
      uploadApiUrl,
      resetPasswordUrl = "https://ucc.bseindia.com/UCC_REST_API_SERVICE/UCCService.svc/ResetPassword",
      resetPanStatusUrl = "https://ucc.bseindia.com/UCC_REST_API_SERVICE/UCCService.svc/PANStatus",
      publicKey = "",
    } = req.body;

    const adminId = req.user?.userId || req.user?._id;
    const istDate = getISTDate(new Date());

    if (!memberId || !userId || !password || !uploadApiUrl) {
      return res.status(400).json({
        success: false,
        message: "Member ID, User ID, Password, and Upload API URL are required!",
      });
    }

    let config = await BseExchangeConfig.findOne().sort({ createdAt: -1 });

    if (config) {
      // Add to history before updating
      if (!config.updateHistory) config.updateHistory = [];
      config.updateHistory.push({
        updatedBy: adminId,
        updatedAt: istDate,
        previousData: {
          memberId: config.memberId,
          userId: config.userId,
          password: config.password,
          uccVersion: config.uccVersion,
          uploadApiUrl: config.uploadApiUrl,
          resetPasswordUrl: config.resetPasswordUrl,
          resetPanStatusUrl: config.resetPanStatusUrl,
          publicKey: config.publicKey,
        },
      });

      config.memberId = memberId;
      config.userId = userId;
      config.password = password;
      config.uccVersion = uccVersion;
      config.uploadApiUrl = uploadApiUrl;
      config.resetPasswordUrl = resetPasswordUrl;
      config.resetPanStatusUrl = resetPanStatusUrl;
      if (publicKey) config.publicKey = publicKey;
      config.updatedBy = adminId;
      config.updatedAt = istDate;

      await config.save();
    } else {
      config = new BseExchangeConfig({
        memberId,
        userId,
        password,
        uccVersion,
        uploadApiUrl,
        resetPasswordUrl,
        resetPanStatusUrl,
        publicKey,
        updatedBy: adminId,
        createdAt: istDate,
        updatedAt: istDate,
        updateHistory: [],
      });
      await config.save();
    }

    return res.status(200).json({
      success: true,
      message: "BSE Exchange configuration saved successfully",
      data: config,
    });
  } catch (error) {
    console.error("Error updating BSE Exchange Config:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
