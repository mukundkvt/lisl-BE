import BseConfig from "../models/BseConfig.js";

// Get Current BSE Config
export const getBseConfig = async (req, res) => {
  try {
    const config = await BseConfig.findOne().sort({ createdAt: -1 }); // Get the latest one or the only one
    if (!config) {
      return res.status(404).json({ success: false, message: "BSE Config not found" });
    }
    // Return config but maybe mask password? For now sending as is for admin usage.
    return res.status(200).json({ success: true, data: config });
  } catch (error) {
    console.error("Error fetching BSE Config:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Update or Create BSE Config
export const updateBseConfig = async (req, res) => {
  try {
    const { userId, memberCode, password, apiUrl } = req.body;
    const adminId = req.user?._id; // Assuming auth middleware attaches user

    if (!userId || !memberCode || !password || !apiUrl) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    let config = await BseConfig.findOne().sort({ createdAt: -1 });

    if (config) {
      // Add to history before updating
      config.updateHistory.push({
        updatedBy: adminId,
        updatedAt: new Date(),
        previousData: {
          userId: config.userId,
          memberCode: config.memberCode,
          password: config.password,
          apiUrl: config.apiUrl,
        },
      });

      config.userId = userId;
      config.memberCode = memberCode;
      config.password = password;
      config.apiUrl = apiUrl;
      await config.save();
    } else {
      // Create new
      config = new BseConfig({
        userId,
        memberCode,
        password,
        apiUrl,
        updateHistory: [
          {
            updatedBy: adminId,
            updatedAt: new Date(),
            previousData: null, // First entry
          },
        ],
      });
      await config.save();
    }

    return res.status(200).json({ success: true, message: "BSE Config updated successfully", data: config });
  } catch (error) {
    console.error("Error updating BSE Config:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
