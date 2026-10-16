import DeletedUser from "../models/DeletedUserSchema.js";
import User from "../models/User.js";
import DpId from "../models/DpId.js";
import { getISTDate } from "../utils/convertToIndianTimeDate.js";
import detectInputType from "../utils/detectInputType.js";
import deleteIfExists from "../utils/hasExistsFile.js";

export const searchUserDataByQuery = async (req, res) => {
  try {
    const input = req.query.search;
    if (!input) {
      return res.status(400).json({
        success: false,
        message: "Query param 'q' is required",
      });
    }

    const type = detectInputType(input);
    let query = {};

    if (type === "mobileNumber") {
      query = { mobileNumber: Number(input) };
    } else if (type === "PAN") {
      query = { PAN: input.toUpperCase() };
    } else if (type === "email") {
      query = { email: input.toLowerCase() };
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid input format",
      });
    }

    const user = await User.findOne(query); // find only 1 exact match

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with given input",
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        signed: user.digitalSignatureContract.signedByClient,
      },
      message: "User found successfully.",
    });
  } catch (error) {
    console.error("Error searchUserDataByQuery :", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const deleteUserData = async (req, res) => {
  try {
    const { userId: Admin } = req.user;
    const userId = req.params.userId;
    const reason = req.body?.reason;

    // 3. Validate reason
    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Reason for deletion is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.digitalSignatureContract?.signedByClient) {
      return res.status(400).json({
        success: false,
        message: "Cant delete user",
      });
    }
    // 1. Simple fields
    await deleteIfExists(user.PAN_file);
    await deleteIfExists(user.aadhaar_file);
    await deleteIfExists(user.aadhaar_photo);
    await deleteIfExists(user.aadhaar_xml);

    // 2. Signature
    if (user.signature) {
      await deleteIfExists(user.signature.signature_image);
      await deleteIfExists(user.signature.signature_pdf);
    }

    // 3. IPV details
    if (user.ipv_details) {
      await deleteIfExists(user.ipv_details.capturedImage);
    }

    // 4. Digital signature contract
    if (user.digitalSignatureContract) {
      await deleteIfExists(user.digitalSignatureContract.unSignedPdf);
      await deleteIfExists(user.digitalSignatureContract.signedPdf);
    }

    // 5. Address proof
    if (user.addressProof) {
      await deleteIfExists(user.addressProof.frontImage);
      await deleteIfExists(user.addressProof.backImage);
      await deleteIfExists(user.addressProof.mergedPdf);
    }

    // 6. Financial proofs (array of objects)
    if (user.financialProofs && Array.isArray(user.financialProofs)) {
      for (const proof of user.financialProofs) {
        await deleteIfExists(proof.filePath);
      }
    }
    if (user.exchange?.financialProofs && Array.isArray(user.exchange.financialProofs)) {
      for (const proof of user.exchange.financialProofs) {
        await deleteIfExists(proof.filePath);
      }
    }

    // 7. Bank proof
    if (user.bank_account_details?.bank_proof_file) {
      await deleteIfExists(user.bank_account_details.bank_proof_file);
    }

    // 8. Annexure J Contract
    if (user.annexureJContract) {
      await deleteIfExists(user.annexureJContract.unSignedPdf);
      await deleteIfExists(user.annexureJContract.signedPdf);
    }

    // Release DP ID if assigned
    if (user.dpId) {
      const dpIdRecord = await DpId.findOne({ dpId: user.dpId });
      if (dpIdRecord) {
        dpIdRecord.is_used = false;
        dpIdRecord.assignedTo = null;
        dpIdRecord.assignedAt = null;
        await dpIdRecord.save();
      }
    }

    await DeletedUser.create({
      name: user.name?.fullName,
      PAN: user.PAN,
      email: user.email,
      mobileNumber: user.mobileNumber,
      deletedBy: Admin,
      reason: reason,
      deletedAt: getISTDate(new Date()),
    });

    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Unexpected error in deleteUserData:", error.message);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};
