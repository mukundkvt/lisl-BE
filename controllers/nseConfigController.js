import NseConfig from "../models/NseConfig.js";
import { getISTDate } from "../utils/convertToIndianTimeDate.js";

export const updateNseConfig = async (req, res) => {
  try {
    const { username, password, authUrl, clientUploadUrl } = req.body;
    const istDate = getISTDate(new Date());

    const updated = await NseConfig.findOneAndUpdate(
      {},
      {
        $set: {
          username,
          password,
          authUrl,
          clientUploadUrl,
          updatedBy: req.user.userId,
          updatedAt: istDate,
        },
        $setOnInsert: {
          createdAt: istDate,
        },
      },
      { new: true, upsert: true, timestamps: false }
    );

    res.json({
      success: true,
      message: "NSE credentials updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update NSE credentials",
    });
  }
};

export const getNseConfig = async (req, res) => {
  try {
    const data = await NseConfig.findOne()
      .select("+password")
      .populate("updatedBy", "name role");

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch NSE auth history",
    });
  }
};
