import { toIST } from "../utils/time.js";
import CamsConfig from "../models/CamsConfig.js";

export const addCamsConfig = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "username and password are required",
      });
    }

    const creds = await CamsConfig.create({
      username,
      password,
    });

    return res.status(201).json({
      success: true,
      message: "CAMS credentials created",
      data: {
        id: creds._id,
        username: creds.username,
        lastUpdatedAtIST: toIST(creds.updatedAt),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const getCamsConfig = async (req, res) => {
  try {
    const creds = await CamsCredential.findOne().sort({ updatedAt: -1 });

    if (!creds) {
      return res.status(404).json({
        success: false,
        message: "CAMS credentials not found",
      });
    }

    return res.json({
      success: true,
      data: {
        id: creds._id,
        username: creds.username,
        password: creds.password, // (UI me mask karna)
        lastUpdatedAtIST: toIST(creds.updatedAt),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

export const updateCamsConfig = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "username and password are required",
      });
    }

    const creds = await CamsCredential.findOneAndUpdate(
      {},
      { username, password },
      { new: true, upsert: true } // important
    );

    return res.json({
      success: true,
      message: "CAMS credentials updated",
      data: {
        id: creds._id,
        username: creds.username,
        lastUpdatedAtIST: toIST(creds.updatedAt),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
