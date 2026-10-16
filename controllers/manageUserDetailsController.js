import mongoose from "mongoose";
import User from "../models/User.js";

export const assignClientCodeManually = async (req, res, next) => {
  try {
    const { userId } = req.params;
    let { clientCode } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Valid User ID is required" });
    }

    if (!clientCode || typeof clientCode !== "string" || !clientCode.trim()) {
      return res.status(400).json({ message: "Client code is required" });
    }

    clientCode = clientCode.trim().toUpperCase();

    if (!/^[A-Z0-9]+$/.test(clientCode)) {
      return res.status(400).json({
        message: "Client code must contain only letters and numbers without spaces or special characters",
      });
    }

    // 1. Find target user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Check if client code is already assigned to this user
    if (user.clientCode && user.clientCode.trim() !== "") {
      return res.status(400).json({
        message: `Client code is already assigned (${user.clientCode}) and cannot be changed.`,
      });
    }

    // 3. Check against SharePro backoffice API first
    const shareProUrl = `${process.env.SHARE_PRO_API}/ClientUCCCheckList`;
    let shareProResponse;
    try {
      shareProResponse = await fetch(shareProUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: process.env.SHARE_PRO_API_KEY,
          UCCList: [clientCode],
        }),
      });
    } catch (apiErr) {
      console.error("[assignClientCodeManually] Error calling SharePro API:", apiErr);
      return res.status(502).json({
        message: "Unable to connect to SharePro backoffice API to verify client code. Please try again later.",
      });
    }

    if (!shareProResponse.ok) {
      const errText = await shareProResponse.text();
      console.error("[assignClientCodeManually] SharePro API non-ok status:", shareProResponse.status, errText);
      return res.status(502).json({
        message: "SharePro backoffice returned an error while verifying client code. Please try again.",
      });
    }

    const shareProData = await shareProResponse.json();
    console.log(`[assignClientCodeManually] SharePro check result:`, shareProData);

    if (Array.isArray(shareProData)) {
      const matched = shareProData.find(
        (item) => item.UCC?.trim().toUpperCase() === clientCode
      );
      if (
        matched &&
        (matched.success === 1 ||
          matched.message?.toLowerCase().includes("exists") ||
          matched.message === "UCC exists")
      ) {
        return res.status(400).json({
          message: `Client code '${clientCode}' already exists in SharePro backoffice.`,
        });
      }
    }

    // 4. Check if client code already exists in DB for another client
    const existingUser = await User.findOne({
      clientCode: { $regex: new RegExp(`^${clientCode}$`, "i") },
      _id: { $ne: user._id },
    });

    if (existingUser) {
      return res.status(400).json({
        message: `Client code '${clientCode}' already exists in KYC database.`,
      });
    }

    // 5. Assign and save
    user.clientCode = clientCode;
    await user.save();

    console.log(
      `[assignClientCodeManually] Successfully assigned clientCode '${clientCode}' to user ${user._id} by ${req.user?.loginName || req.user?.role}`
    );

    return res.status(200).json({
      success: true,
      message: `Client code '${clientCode}' assigned successfully`,
      clientCode: clientCode,
    });
  } catch (error) {
    console.error("assignClientCodeManually Error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const updateAddressProofNumber = async (req, res, next) => {
  try {
    const userId = req.params.userId; // fetch user id from route params
    const { addressProof_Number } = req.body; // new number from request body

    // Validate input
    if (!addressProof_Number) {
      return res
        .status(400)
        .json({ message: "Address proof number is required" });
    }

    // Find and update user (only addressProof.number)
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "addressProof.number": addressProof_Number,
        },
      },
      { new: true } // return updated document
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Address proof number updated successfully",
      user : user.addressProof,
    });
  } catch (error) {
    console.error("updateAddressProofNumber Error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const updateAddress = async (req, res, next) => {
  try {
    const userId = req.params.userId; // userId from URL params
    const {
      addressLine1,
      addressLine2,
      addressLine3,
      city,
      
    } = req.body; // fields from request body

    // Build $set object dynamically
    const updateFields = {};
    if (addressLine1) updateFields["address.addressLine1"] = addressLine1;
    if (addressLine2) updateFields["address.addressLine2"] = addressLine2;
    if (addressLine3) updateFields["address.addressLine3"] = addressLine3;
    if (city) updateFields["address.city"] = city;
   

    // Update only provided fields inside nested address
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true } // return updated document
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Address updated successfully",
      address: user.address,
    });
  } catch (error) {
    console.error("updateAddress Error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};


// Update User Bank Details (Bank Name, MICR Code, Address)
export const updateBankDetails = async (req, res) => {
    try {
        const { userId } = req.params;
        const { bank_name, micr_code, address } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const updateFields = {};
        if (bank_name) updateFields['bank_account_details.bank_name'] = bank_name;
        if (micr_code) updateFields['bank_account_details.micr_code'] = micr_code;
        if (address) updateFields['bank_account_details.address'] = address;

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: "No fields provided for update" });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).select('bank_account_details');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({
            message: "Bank details updated successfully",
            data: user.bank_account_details
        });

    } catch (error) {
        console.error("updateBankDetails Error:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error.message
        });
    }
};
