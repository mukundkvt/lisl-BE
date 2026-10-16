//For User

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Scheme from "../models/Scheme.js";
import { getISTDate } from "../utils/convertToIndianTimeDate.js";

const getExchangeData = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) return res.status(404).json({ message: "User not found" });

    let appliedScheme = user.appliedScheme;
    let schemeDetails = null;

    if (appliedScheme?._id) {
      await user.populate("appliedScheme._id");
      if (user.appliedScheme?._id && typeof user.appliedScheme._id === "object") {
        schemeDetails = user.appliedScheme._id;
      }
    }

    if (!schemeDetails) {
      const defaultScheme =
        (await Scheme.findOne({ isDefault: true })) ||
        (await Scheme.findOne({ isActive: true }));
      if (defaultScheme) {
        user.appliedScheme = {
          _id: defaultScheme._id,
          schemeName: defaultScheme.schemeName,
        };
        await user.save();
        schemeDetails = defaultScheme;
      }
    }

    // Return exchange data from user schema
    res.status(200).json({
      message: "Exchange data retrieved successfully",
      data: {
        tradingSegments: user.exchange?.tradingSegments || [],
        segments: user.exchange?.segments || {
          Cash: false,
          FO: false,
          MF: false,
          Commodities: false,
        },
        customerClassification:
          user.exchange?.customerClassification || "Others",
        appliedScheme: user.appliedScheme,
        schemeDetails: schemeDetails,
      },
    });
  } catch (error) {
    console.error("Error fetching exchange data:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const submitExchange = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findOne({ mobileNumber: decoded.mobileNumber });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { tradingSegments, customerClassification, filePaths } = req.body;

    // Validate tradingSegments as an array
    if (!Array.isArray(tradingSegments)) {
      return res
        .status(400)
        .json({ message: "tradingSegments must be an array" });
    }

    // Validate allowed segments
    const validSegments = ["Cash", "FO", "MF", "Commodities"];
    const invalidSegments = tradingSegments.filter(
      (segment) => !validSegments.includes(segment)
    );
    if (invalidSegments.length > 0) {
      return res
        .status(400)
        .json({
          message: `Invalid trading segments: ${invalidSegments.join(", ")}`,
        });
    }

    if (!tradingSegments || tradingSegments.length === 0) {
      return res.status(400).json({ message: "Missing tradingSegments" });
    }

    if (tradingSegments.includes("Commodities") && !customerClassification) {
      return res
        .status(400)
        .json({ message: "Missing customerClassification for Commodities" });
    }

    // Initialize exchange if not present
    if (!user.exchange) {
      user.exchange = { segments: {}, financialProofs: [] };
    }

    // Update segments based on the array
    user.exchange.segments = {
      Cash: tradingSegments.includes("Cash"),
      FO: tradingSegments.includes("FO"),
      MF: tradingSegments.includes("MF"),
      Commodities: tradingSegments.includes("Commodities"),
    };
    user.exchange.customerClassification = customerClassification || "Others";

    // Overwrite financialProofs with new data
    if (filePaths && filePaths.length > 0) {
      user.exchange.financialProofs = filePaths.map((file) => {
        const { path: filePath, fileName, fileExtension } = file;
        return {
          type: fileName,
          filePath: filePath,
          uploadedAt: new Date(),
        };
      });
    } else {
      // If no filePaths provided, reset financialProofs to empty array
      user.exchange.financialProofs = [];
    }

    user.max_step_completed = Math.max(user.max_step_completed || 0, 6);

    if (!user.rejectedStepsDone) user.rejectedStepsDone = [];
    if (user.rejectedSteps?.includes(5) && !user.rejectedStepsDone.includes(5)) {
      user.rejectedStepsDone.push(5);
    }
    if (user.approvals?.exchange) {
      user.approvals.exchange.status = "pending";
    }

    await user.save();

    res.status(200).json({
      message: "Exchange preferences updated successfully",
      data: {
        segments: user.exchange.segments,
        customerClassification: user.exchange.customerClassification,
        financialProofs: user.exchange.financialProofs,
      },
    });
  } catch (error) {
    console.error("Error updating exchange data:", error);
    if (error.message.includes("Unexpected field")) {
      return res.status(400).json({ message: error.message });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export { getExchangeData, submitExchange };
