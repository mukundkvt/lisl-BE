import User from "../models/User.js";
import Branch from "../models/Branch.js";
import Scheme from "../models/Scheme.js";
import Referral from "../models/Referral.js";
import AdminUser from "../models/AdminUser.js";
import { formatToIST, getISTDate } from "../utils/convertToIndianTimeDate.js";
import mongoose from "mongoose";
import { getAnnexureJEnabledValue } from "../controllers/settingController.js";

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1),
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function removeNamePrefix(name) {
  if (!name) return "";
  let cleaned = String(name).trim();
  const prefixRegex =
    /^(?:mr|mrs|ms|miss|mx|dr|prof|shri|sri|shree|smt|kumari|km|master|m\/s)(?:\.|\b)\s*/i;
  while (prefixRegex.test(cleaned)) {
    const prev = cleaned;
    cleaned = cleaned.replace(prefixRegex, "").trim();
    if (cleaned === prev) break;
  }
  return cleaned;
}

function checkNameMatch(name1, name2) {
  if (!name1 || !name2) return false;
  const clean1 = removeNamePrefix(name1);
  const clean2 = removeNamePrefix(name2);
  const n1 = clean1.trim().toLowerCase().replace(/\s+/g, " ");
  const n2 = clean2.trim().toLowerCase().replace(/\s+/g, " ");
  if (n1 === n2) return true;

  const norm1 = n1
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const norm2 = n2
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (norm1 === norm2) return true;

  const tokens1 = norm1.split(" ").filter(Boolean).sort();
  const tokens2 = norm2.split(" ").filter(Boolean).sort();
  if (tokens1.length > 0 && tokens1.join(" ") === tokens2.join(" ")) return true;

  return false;
}
// import { formatToIST } from "../utils/formatDate.js";

export const buildRoleScopingQuery = async (role, adminUserId, adminUser) => {
  switch (role) {
    case "Authorised Person":
      return {
        $or: [
          { "authorisedPerson._id": adminUserId },
          { "referredBy._id": adminUserId },
        ],
      };

    case "Relationship Manager": {
      const directReferrals = { "relationshipManager._id": adminUserId };
      const teamMemberIds = (adminUser?.teamMembers || []).map((member) => member._id);
      const apUsers = await AdminUser.find({
        role: "Authorised Person",
        $or: [{ reportingTo: adminUserId }, { _id: { $in: teamMemberIds } }],
      }).select("_id");
      const allApIds = apUsers.map((a) => a._id);

      return {
        $or: [
          directReferrals,
          { "authorisedPerson._id": { $in: allApIds } },
          { "referredBy._id": { $in: allApIds } },
        ],
      };
    }

    case "Branch": {
      const branchId = adminUser?.branch || adminUserId;
      const branchStaff = await AdminUser.find({ branch: branchId }).select("_id");
      const staffIds = branchStaff.map((s) => s._id);

      return {
        $or: [
          { "branch._id": branchId },
          { "relationshipManager._id": { $in: staffIds } },
          { "authorisedPerson._id": { $in: staffIds } },
          { "referredBy._id": { $in: staffIds } },
        ],
      };
    }

    case "Scrutiny Officer":
    case "Supervisor":
    case "Admin":
    case "Management":
      return {};

    default:
      return null;
  }
};


/**
 * Get users based on admin user role
 * - Authorized Person: Returns users referred by that AP
 * - Relationship Manager: Returns users referred by RM and their team members (APs)
 * - Branch: Returns all users under that branch, including RM and AP referrals
 * - Scrutiny Officer/Supervisor: Returns all users
 */
export const getUsersByRole = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const {
      page = 1,
      limit = 10,
      search,
      startDate,
      endDate,
      userStatus,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let query = { userStatus: { $ne: "none" } }; // Exclude "none" by default
    let users = [];

    // Handle userStatus filter
    if (
      userStatus &&
      userStatus !== "none" && // Exclude "none" from being a filter
      [
        "none",
        "pending",
        "approved",
        "esigned",
        "rejected",
        "completed",
      ].includes(userStatus)
    ) {
      query.userStatus = userStatus;
    }

    // Handle search query
    if (search && search !== "none") {
      // Exclude "none" from being a search filter
      const searchRegex = new RegExp(search, "i");
      query.$or = [
        { PAN: searchRegex },
        { clientCode: searchRegex },
        { "name.fullName": searchRegex },
        { "address.city": searchRegex },
        { "address.pincode": searchRegex },
      ];
    }

    // Handle date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        // Convert IST date string to UTC for MongoDB query
        const startDateTime = new Date(startDate);
        startDateTime.setHours(0, 0, 0, 0);
        startDateTime.setHours(startDateTime.getHours() - 5);
        startDateTime.setMinutes(startDateTime.getMinutes() - 30);
        query.createdAt.$gte = startDateTime;
      }
      if (endDate) {
        // Convert IST date string to UTC for MongoDB query
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        endDateTime.setHours(endDateTime.getHours() - 5);
        endDateTime.setMinutes(endDateTime.getMinutes() - 30);
        query.createdAt.$lte = endDateTime;
      }
    }

    // Convert userId to ObjectId
    const adminUserId = new mongoose.Types.ObjectId(userId);

    // Find the admin user to get additional details
    const adminUser = await AdminUser.findById(adminUserId);
    if (!adminUser) {
      return res
        .status(404)
        .json({ status: "failed", message: "Admin user not found" });
    }

    // Base query to only include users with panConfirmed = true
    const baseQuery = { panConfirmed: true };

    // Store the role-based conditions separately
    const roleQuery = await buildRoleScopingQuery(role, adminUserId, adminUser);
    if (roleQuery === null) {
      return res
        .status(403)
        .json({ status: "failed", message: "Unauthorized role" });
    }

    // Combine all query conditions
    query = {
      ...baseQuery,
      ...(query.userStatus ? { userStatus: query.userStatus } : {}),
      ...(query.createdAt ? { createdAt: query.createdAt } : {}),
      ...(query.$or ? { $and: [{ $or: query.$or }, roleQuery] } : roleQuery),
    };

    // Fetch users with the constructed query
    const totalUsers = await User.countDocuments(query);
    users = await User.find(query)
      .select(
        "_id name gender email mobileNumber PAN clientCode panConfirmed createdAt updatedAt authorisedPerson relationshipManager approvals referredBy userStatus kycType",
      )
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalPages = Math.ceil(totalUsers / parseInt(limit));

    // Format the response data
    const formattedUsers = users.map((user) => {
      // const referredBy = user.authorisedPerson?._id
      //   ? {
      //       name: user.authorisedPerson.name,
      //       employeeId: user.authorisedPerson.employeeId,
      //       role: "Authorised Person",
      //       mobileNumber: user.authorisedPerson.mobileNumber,
      //     }
      //   : user.relationshipManager?._id
      //   ? {
      //       name: user.relationshipManager.name,
      //       employeeId: user.relationshipManager.employeeId,
      //       role: "Relationship Manager",
      //       mobileNumber: user.relationshipManager.mobileNumber,
      //     }
      //   : null;

      return {
        _id: user._id,
        clientCode: user.clientCode || null,
        name:
          user.name.fullName ||
          `${user.name.firstName || ""} ${user.name.middleName || ""} ${
            user.name.lastName || ""
          }`.trim(),
        gender: user.gender,
        email: user.email,
        mobileNumber: user.mobileNumber,
        PAN: user.PAN,
        panConfirmed: user.panConfirmed,
        createdAt: formatToIST(user.createdAt),
        updatedAt: formatToIST(user.updatedAt),
        userStatus: user.userStatus,
        referredBy: user.referredBy,
        signedTime: user.digitalSignatureContract?.signedTime
          ? formatToIST(user.digitalSignatureContract.signedTime)
          : "",
        kycType: user.kycType,
        approvals: {
          address: user.approvals.address
            ? { status: user.approvals.address.status }
            : undefined,
          profile: user.approvals.profile
            ? { status: user.approvals.profile.status }
            : undefined,
          bank: user.approvals.bank
            ? { status: user.approvals.bank.status }
            : undefined,
          demat: user.approvals.demat
            ? { status: user.approvals.demat.status }
            : undefined,
          exchange: user.approvals.exchange
            ? { status: user.approvals.exchange.status }
            : undefined,
          ipv: user.approvals.ipv
            ? { status: user.approvals.ipv.status }
            : undefined,
          digitalSign: user.approvals.digitalSign
            ? { status: user.approvals.digitalSign.status }
            : undefined,
        },
      };
    });

    return res.status(200).json({
      status: "success",
      page: parseInt(page),
      limit: parseInt(limit),
      totalUsers: totalUsers,
      totalPages: totalPages,
      data: formattedUsers,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res
      .status(500)
      .json({ status: "failed", message: "Internal server error" });
  }
};

// Helper function to check access
const hasAccessToUser = async (reqUser, targetUser) => {
  const { userId, role } = reqUser;

  switch (role) {
    case "Admin":
    case "Scrutiny Officer":
    case "Supervisor":
    case "Management":
      return true;

    case "Relationship Manager": {
      const adminUserId = new mongoose.Types.ObjectId(userId);
      if (targetUser.relationshipManager?._id?.equals(adminUserId)) {
        return true;
      }
      const adminUser = await AdminUser.findById(adminUserId);
      const teamMemberIds = (adminUser?.teamMembers || []).map((m) => m._id?.toString());
      if (targetUser.authorisedPerson?._id && teamMemberIds.includes(targetUser.authorisedPerson._id.toString())) {
        return true;
      }
      if (targetUser.authorisedPerson?._id) {
        const ap = await AdminUser.findById(targetUser.authorisedPerson._id);
        if (ap?.reportingTo?.equals(adminUserId)) return true;
      }
      return false;
    }

    case "Authorised Person": {
      const adminUserId = new mongoose.Types.ObjectId(userId);
      return !!targetUser.authorisedPerson?._id?.equals(adminUserId) || !!targetUser.referredBy?._id?.equals(adminUserId);
    }

    case "Branch": {
      const adminUserId = new mongoose.Types.ObjectId(userId);
      const adminUser = await AdminUser.findById(adminUserId);
      if (!adminUser) return false;

      const userBranchId = targetUser.branch?._id
        ? targetUser.branch._id.toString()
        : (targetUser.branch?.toString ? targetUser.branch.toString() : null);

      const branchId = adminUser.branch ? adminUser.branch.toString() : null;
      if ((branchId && userBranchId === branchId) || userBranchId === adminUserId.toString()) {
        return true;
      }
      if (targetUser.authorisedPerson?._id) {
        const ap = await AdminUser.findById(targetUser.authorisedPerson._id);
        if (ap?.branch?.toString() === branchId) return true;
      }
      if (targetUser.relationshipManager?._id) {
        const rm = await AdminUser.findById(targetUser.relationshipManager._id);
        if (rm?.branch?.toString() === branchId) return true;
      }
      return false;
    }

    default:
      return false;
  }
};

// ✅ Get User Address By Id
export const getUserAddressById = async (req, res) => {
  try {
    const { userId } = req.user;
    const targetUserId = req.params.userId;

    const user = await User.findById(targetUserId);

    if (!user) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }
    if (!(await hasAccessToUser(req.user, user))) {
      return res
        .status(403)
        .json({ status: "failed", message: "Access denied" });
    }

    const userAddress = {
      name: user.name,
      address: user.address,
      addressProof: user.addressProof,
      kycType: user.kycType,
      pan: user.PAN,
      panFile: user.PAN_file,
      email: user.email,
      mobileNumber: user.mobileNumber,
      referredBy: user.referredBy,
      clientCode: user.clientCode,
      aadhaar_file: user.aadhaar_file,
      aadhaarNumber: user.aadhaar_number,
      adharXML: user.aadhaar_xml,
      panDetails: user.panDetails,
    };
    return res.status(200).json({
      status: "success",
      message: "User address fetched successfully",
      userAddress: userAddress,
      kycType: user.kycType,
      clientCode: user.clientCode,
      referredBy: user.referredBy,
      addressApproval: user.approvals?.address,
      isNameMatchPAN: user.isNameMatchPAN,
      nameAsPerAddressProof: user.nameAsPerAddressProof,
    });
  } catch (error) {
    console.error("Error fetching user bank details:", error);
    return res
      .status(500)
      .json({ status: "failed", message: "Internal server error" });
  }
};

// ✅ Get User Bank Details By Id
export const getUserBankDetailsById = async (req, res) => {
  try {
    const { userId } = req.user;
    const targetUserId = req.params.userId;

    const user = await User.findById(targetUserId);

    if (!user) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }

    if (!(await hasAccessToUser(req.user, user))) {
      return res
        .status(403)
        .json({ status: "failed", message: "Access denied" });
    }
    const bankDetails = {
      name: user.name,
      bank_account_details: user.bank_account_details,
    };

    const userFullName =
      user.name?.fullName ||
      user.panDetails?.name ||
      (typeof user.name === "string" ? user.name : "") ||
      [user.name?.firstName, user.name?.middleName, user.name?.lastName]
        .filter(Boolean)
        .join(" ");

    const isBankNameMatched =
      checkNameMatch(
        userFullName,
        user.bank_account_details?.account_holder_name
      ) ||
      checkNameMatch(
        user.panDetails?.name,
        user.bank_account_details?.account_holder_name
      );

    return res.status(200).json({
      status: "success",
      message: "User bank details fetched successfully",
      bankDetails: bankDetails,
      kycType: user.kycType,
      clientCode: user.clientCode,
      referredBy: user.referredBy,
      bankApproval: user.approvals?.bank,
      isNameMatchPAN: user.isNameMatchPAN,
      isBankNameMatched: isBankNameMatched,
      nameAsPerAddressProof: user.nameAsPerAddressProof,
      bank_proof_file: user.bank_account_details?.bank_proof_file,
      bank_proof_date: user.bank_account_details?.bank_proof_date
        ? formatToIST(user.bank_account_details.bank_proof_date)
        : "N/A",
    });
  } catch (error) {
    console.error("Error fetching user bank details:", error);
    return res
      .status(500)
      .json({ status: "failed", message: "Internal server error" });
  }
};

// ✅ Get User Profile By Id
export const getUserProfileById = async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    const user = await User.findById(targetUserId);

    if (!user) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }

    if (!(await hasAccessToUser(req.user, user))) {
      return res
        .status(403)
        .json({ status: "failed", message: "Access denied" });
    }

    const userProfile = {
      name: user.name,
      gender: user.gender,
      maritalStatus: user.maritalStatus,
      address: user.address,
      email: user.email,
      mobileNumber: user.mobileNumber,
      dateOfBirth: user.dateOfBirth,
      PAN: user.PAN,
      fatherName: user.fatherName,
      motherName: user.motherName,
      occupation: user.occupation,
      qualification: user.qualification,
      tradingExperience: user.tradingExperience,
      PanFile: user.PAN_file,
      annualIncome: user.annualIncome,
      nominees: user.nominees,
      signature: user.signature,
      ipv_details: user.ipv_details,
    };

    return res.status(200).json({
      status: "success",
      message: "User profile fetched successfully",
      userProfile: userProfile,
      kycType: user.kycType,
      clientCode: user.clientCode,
      referredBy: user.referredBy,
      profileApproval: user.approvals?.profile,
      isNameMatchPAN: user.isNameMatchPAN,
      nameAsPerAddressProof: user.nameAsPerAddressProof,
      email: user.email,
      dob: user.dateOfBirth,
      PAN: user.PAN,
      PAN_file: user.PAN_file,
      signature_image: user.signature?.signature_image,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res
      .status(500)
      .json({ status: "failed", message: "Internal server error" });
  }
};

// ✅ Get User Exchange
export const getUserExchangeById = async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    const user = await User.findById(targetUserId);

    if (!user) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }

    if (!(await hasAccessToUser(req.user, user))) {
      return res
        .status(403)
        .json({ status: "failed", message: "Access denied" });
    }

    await user.populate("appliedScheme._id");

    const ddpiConcent = user.ddpiConcent || {};
    const ddpiOpted =
      ddpiConcent.transfer_of_security ||
      ddpiConcent.pledging ||
      ddpiConcent.mutual_fund_transaction ||
      ddpiConcent.tendering_shares;

    const userExchange = {
      enchange: user.exchange,
      appliedScheme: user.appliedScheme,
      ddpiConcent: user.ddpiConcent,
      dpId: user.dpId,
      ddpiOpted: !!ddpiOpted,
    };
    return res.status(200).json({
      status: "success",
      message: "User Exchange fetched successfully",
      userExchange: userExchange,
      kycType: user.kycType,
      clientCode: user.clientCode,
      referredBy: user.referredBy,
      exchangeApproval: user.approvals?.exchange,
      isNameMatchPAN: user.isNameMatchPAN,
      nameAsPerAddressProof: user.nameAsPerAddressProof,
    });
  } catch (error) {
    console.error("Error fetching user exchange:", error);
    return res
      .status(500)
      .json({ status: "failed", message: "Internal server error" });
  }
};

// ✅ Get User Digital Signature
export const getUserDigitalSignatureById = async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    const user = await User.findById(targetUserId);

    if (!user) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }

    if (!(await hasAccessToUser(req.user, user))) {
      return res
        .status(403)
        .json({ status: "failed", message: "Access denied" });
    }

    const digitalSignatureContract = user.digitalSignatureContract
      ? user.digitalSignatureContract.toObject()
      : {};
    const annexureJEnabled = await getAnnexureJEnabledValue();
    if (annexureJEnabled && user.annexureJContract?.signedPdf) {
      digitalSignatureContract.AnnexureJ = user.annexureJContract.signedPdf;
    }

    return res.status(200).json({
      status: "success",
      message: "User Digital Signature fetched successfully",
      digitalSignature: {
        name: user.name,
        aadhaarXML: user.aadhaar_xml,
        digitalSignatureContract: digitalSignatureContract,
        panDetails: user.panDetails,
      },
      kycType: user.kycType,
      clientCode: user.clientCode,
      referredBy: user.referredBy,
      digitalSignApproval: user.approvals?.digitalSign,
      isNameMatchPAN: user.isNameMatchPAN,
      nameAsPerAddressProof: user.nameAsPerAddressProof,
    });
  } catch (error) {
    console.error("Error fetching user digital signature:", error);
    return res
      .status(500)
      .json({ status: "failed", message: "Internal server error" });
  }
};

// ✅ Get User getUserInPersonVerificationById
export const getUserInPersonVerificationById = async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    const user = await User.findById(targetUserId);

    if (!user) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }

    if (!(await hasAccessToUser(req.user, user))) {
      return res
        .status(403)
        .json({ status: "failed", message: "Access denied" });
    }
    const ipv_details = {
      panFile: user.PAN_file,
      adharPhoto: user.aadhaar_photo,
      ipv_details: user.ipv_details,
      geolocation: user.geolocation,
    };
    return res.status(200).json({
      status: "success",
      message: "User Digital Signature fetched successfully",
      ipv_details: ipv_details,
      kycType: user.kycType,
      clientCode: user.clientCode,
      referredBy: user.referredBy,
      ipvApproval: user.approvals?.ipv,
      isNameMatchPAN: user.isNameMatchPAN,
      nameAsPerAddressProof: user.nameAsPerAddressProof,
    });
  } catch (error) {
    console.error("Error fetching user digital signature:", error);
    return res
      .status(500)
      .json({ status: "failed", message: "Internal server error" });
  }
};

// getUserPDFGeneration
export const getUserPDFGenerationDetailsById = async (req, res) => {
  try {
    const targetUserId = req.params.userId;

    const user = await User.findById(targetUserId);

    if (!user) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }

    if (!(await hasAccessToUser(req.user, user))) {
      return res
        .status(403)
        .json({ status: "failed", message: "Access denied" });
    }
    const pdfGeneration_details = {
      name: user.name,
      PAN: user.PAN,
      digitalSignatureContract: user.digitalSignatureContract,
    };
    return res.status(200).json({
      status: "success",
      message: "User pdfGeneration details fetched successfully",
      pdfGeneration_details,
      kycType: user.kycType,
      clientCode: user.clientCode,
      referredBy: user.referredBy,
      isNameMatchPAN: user.isNameMatchPAN,
      nameAsPerAddressProof: user.nameAsPerAddressProof,
    });
  } catch (error) {
    console.error("Error fetching user pdfGeneration_details:", error);
    return res
      .status(500)
      .json({ status: "failed", message: "Internal server error" });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { name, mobile, pan: PAN, email, clientCode } = req.query;

    let query = {};
    const adminUserId = new mongoose.Types.ObjectId(userId);
    const adminUser = await AdminUser.findById(adminUserId);

    if (!adminUser) {
      return res
        .status(404)
        .json({ status: "failed", message: "Admin user not found" });
    }

    // Base query to only include users with panConfirmed = true
    const baseQuery = { panConfirmed: true };

    // Hierarchy-based filtering
    const roleQuery = await buildRoleScopingQuery(role, adminUserId, adminUser);
    if (roleQuery === null) {
      return res
        .status(403)
        .json({ status: "failed", message: "Unauthorized role" });
    }
    query = {
      ...baseQuery,
      ...roleQuery,
    };

    // Search by mobile, name, PAN, email, clientCode (partial match)
    const searchQuery = [];
    if (mobile) {
      searchQuery.push({
        $expr: {
          $regexMatch: {
            input: { $toString: "$mobileNumber" },
            regex: new RegExp(mobile, "i"),
          },
        },
      });
    }
    if (PAN) {
      searchQuery.push({ PAN: { $regex: PAN, $options: "i" } });
    }
    if (email) {
      searchQuery.push({ email: { $regex: email, $options: "i" } });
    }
    if (clientCode) {
      searchQuery.push({ clientCode: { $regex: clientCode, $options: "i" } });
    }
    if (name) {
      searchQuery.push({
        $or: [
          { "name.fullName": { $regex: name, $options: "i" } },
          { "name.firstName": { $regex: name, $options: "i" } },
          { "name.middleName": { $regex: name, $options: "i" } },
          { "name.lastName": { $regex: name, $options: "i" } },
        ],
      });
    }

    if (searchQuery.length > 0) {
      query = { ...query, $and: searchQuery };
    }

    const users = await User.find(query)
      .select(
        "_id name mobileNumber PAN email clientCode createdAt authorisedPerson relationshipManager referredBy",
      )
      .populate("referredBy", "name")
      .sort({ updatedAt: -1 });

    const formattedUsers = users.map((user) => {
      let referredByText = "Direct";
      let referrerName = "";
      if (user.authorisedPerson && user.authorisedPerson._id) {
        referredByText = "AP";
        referrerName = user.referredBy.name || "";
      } else if (user.relationshipManager && user.relationshipManager._id) {
        referredByText = "RM";
        referrerName = user.referredBy.name || "";
      } else if (user.referredBy && user.referredBy._id) {
        referredByText = user.referredBy.role;
        referrerName = user.referredBy.name || "";
      }

      return {
        _id: user._id,
        fullName:
          user.name.fullName ||
          `${user.name.firstName || ""} ${user.name.middleName || ""} ${
            user.name.lastName || ""
          }`.trim(),
        PAN: user.PAN,
        mobileNumber: user.mobileNumber,
        email: user.email,
        clientCode: user.clientCode,
        referredBy: referredByText,
        referrerName: referrerName,
        createdAt: formatToIST(user.createdAt),
      };
    });

    return res.status(200).json({
      status: "success",
      count: formattedUsers.length,
      data: formattedUsers,
    });
  } catch (error) {
    console.error("Error searching users:", error);
    return res
      .status(500)
      .json({ status: "failed", message: "Internal server error" });
  }
};

export const getUserStatusCounts = async (req, res) => {
  try {
    const { userId, role } = req.user;
    let query = {};

    // Convert userId to ObjectId
    const adminUserId = new mongoose.Types.ObjectId(userId);

    // Find the admin user to get additional details
    const adminUser = await AdminUser.findById(adminUserId);
    if (!adminUser) {
      return res
        .status(404)
        .json({ status: "failed", message: "Admin user not found" });
    }

    // Base query to only include users with panConfirmed = true
    const baseQuery = { panConfirmed: true };

    const roleQuery = await buildRoleScopingQuery(role, adminUserId, adminUser);
    if (roleQuery === null) {
      return res
        .status(403)
        .json({ status: "failed", message: "Unauthorized role" });
    }
    query = {
      ...baseQuery,
      ...roleQuery,
    };

    // Get counts for each status
    const statusCounts = {
      pending: 0,
      approved: 0,
      esigned: 0,
      rejected: 0,
      completed: 0,
      none: 0,
    };

    // Count users for each status
    for (const status of Object.keys(statusCounts)) {
      const statusQuery = { ...query, userStatus: status };
      statusCounts[status] = await User.countDocuments(statusQuery);
    }

    return res.status(200).json({
      status: "success",
      data: statusCounts,
    });
  } catch (error) {
    console.error("Error fetching user status counts:", error);
    return res
      .status(500)
      .json({ status: "failed", message: "Internal server error" });
  }
};

export const getRejectedUsersById = async (req, res) => {
  try {
    const userId = req.params.userId;

    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ status: "failed", message: "User not found" });
    }

    if (!(await hasAccessToUser(req.user, user))) {
      return res.status(403).json({
        status: "failed",
        message: "You do not have access to this user",
      });
    }

    // Build complete rejection history list
    const rejectionList = [];

    // 1. From user.rejectionHistory (if exists)
    if (Array.isArray(user.rejectionHistory) && user.rejectionHistory.length > 0) {
      for (const item of user.rejectionHistory) {
        rejectionList.push({
          field: item.field,
          status: item.status || "rejected",
          rejectionReason: item.rejectionReason,
          rejectedBy: {
            name: item.rejectedBy?.name || "",
            employeeId: item.rejectedBy?.employeeId || "",
          },
          rejectedAt: formatToIST(item.rejectedAt),
          rawDate: item.rejectedAt ? new Date(item.rejectedAt).getTime() : 0,
        });
      }
    }

    // 2. Also check user.approvals to ensure no rejection is missed
    const approvals = user.approvals || {};
    for (const [key, approval] of Object.entries(approvals)) {
      if (
        approval?.rejectionReason ||
        approval?.rejectedAt ||
        approval?.status === "rejected"
      ) {
        const timeVal = approval.rejectedAt
          ? new Date(approval.rejectedAt).getTime()
          : 0;
        const alreadyExists = rejectionList.some(
          (r) => r.field === key && Math.abs(r.rawDate - timeVal) < 5000
        );
        if (!alreadyExists) {
          rejectionList.push({
            field: key,
            status: approval.status || "rejected",
            rejectionReason: approval.rejectionReason,
            rejectedBy: {
              name: approval.rejectedBy?.name || "",
              employeeId: approval.rejectedBy?.employeeId || "",
            },
            rejectedAt: formatToIST(approval.rejectedAt),
            rawDate: timeVal,
          });
        }
      }
    }

    // Sort newest first
    rejectionList.sort((a, b) => b.rawDate - a.rawDate);

    // Clean up rawDate before sending
    const cleanedRejections = rejectionList.map(({ rawDate, ...rest }) => rest);

    res.status(200).json({
      status: "success",
      data: cleanedRejections,
      kycType: user.kycType,
      clientCode: user.clientCode,
      referredBy: user.referredBy,
    });
  } catch (error) {
    console.error("Error in getRejectedUsersById:", error);
    res.status(500).json({ status: "failed", message: "Server error" });
  }
};

/**
 * Get Dashboard Summary Matrix (Channel vs Stage)
 */
export const getUserDashboardSummary = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { startDate, endDate } = req.query;

    const adminUserId = new mongoose.Types.ObjectId(userId);
    const adminUser = await AdminUser.findById(adminUserId);

    if (!adminUser) {
      return res
        .status(404)
        .json({ status: "failed", message: "Admin user not found" });
    }

    // 1. Build Match Query based on Role and Date
    let matchQuery = {
      userStatus: { $ne: "none" },
      // Ensure PAN exists to be considered at least a "Prospect"
      PAN: { $exists: true, $ne: null },
    };

    // Date Range Filter
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) {
        const [day, month, year] = startDate.split("/");
        const startDateTime = new Date(`${year}-${month}-${day}`);
        startDateTime.setHours(0, 0, 0, 0);
        startDateTime.setHours(startDateTime.getHours() - 5);
        startDateTime.setMinutes(startDateTime.getMinutes() - 30);
        matchQuery.createdAt.$gte = startDateTime;
      }
      if (endDate) {
        const [day, month, year] = endDate.split("/");
        const endDateTime = new Date(`${year}-${month}-${day}`);
        endDateTime.setHours(23, 59, 59, 999);
        endDateTime.setHours(endDateTime.getHours() - 5);
        endDateTime.setMinutes(endDateTime.getMinutes() - 30);
        matchQuery.createdAt.$lte = endDateTime;
      }
    }

    // Role Based Filtering
    const roleQuery = await buildRoleScopingQuery(role, adminUserId, adminUser);
    if (roleQuery === null) {
      return res
        .status(403)
        .json({
          status: "failed",
          message: "Unauthorized role for dashboard",
        });
    }
    Object.assign(matchQuery, roleQuery);

    // 2. Aggregation Pipeline
    const pipeline = [
      { $match: matchQuery },
      {
        $addFields: {
          channel: {
            $switch: {
              branches: [
                {
                  case: { $ifNull: ["$authorisedPerson._id", false] },
                  then: "AP",
                },
                {
                  case: { $ifNull: ["$relationshipManager._id", false] },
                  then: "RM",
                },
              ],
              default: "DIRECT",
            },
          },
          stage: {
            $switch: {
              branches: [
                // 1. Sent to B.O (Highest Priority)
                {
                  case: { $eq: ["$userStatus", "completed"] },
                  then: "Sent to B.O",
                },
                // 2. Rejection
                {
                  case: { $eq: ["$userStatus", "rejected"] },
                  then: "Rejection",
                },
                // 3. Esign
                {
                  case: {
                    $eq: ["$digitalSignatureContract.signedByClient", true],
                  },
                  then: "Esign",
                },
                // 4. IPV
                {
                  case: { $eq: ["$ipv_details.verificationStatus", true] },
                  then: "IPV",
                },
                // 5. Bank
                {
                  case: {
                    $ifNull: ["$bank_account_details.account_number", false],
                  },
                  then: "Bank",
                },
                // 6. Address
                {
                  case: {
                    $ne: [{ $ifNull: ["$address.addressLine1", ""] }, ""],
                  },
                  then: "Address",
                },
                // 7. Prospects (Default if PAN exists as per matchQuery)
                { case: true, then: "Prospects" },
              ],
              default: "Prospects",
            },
          },
        },
      },
      {
        $group: {
          _id: { channel: "$channel", stage: "$stage" },
          count: { $sum: 1 },
        },
      },
    ];

    const results = await User.aggregate(pipeline);

    // 3. Format Response
    const stagesList = [
      "Prospects",
      "Address",
      "Bank",
      "IPV",
      "Esign",
      "Rejection",
      "Sent to B.O",
    ];

    // Initialize standard structure
    const initialStageCounts = stagesList.reduce((acc, stage) => {
      acc[stage] = 0;
      return acc;
    }, {});

    let responseStructure = {};

    // Determine channels based on role
    if (["Authorised Person"].includes(role)) {
      responseStructure = {
        ap: { ...initialStageCounts },
        total: { ...initialStageCounts },
      };
    } else if (["Relationship Manager"].includes(role)) {
      responseStructure = {
        rm: { ...initialStageCounts },
        ap: { ...initialStageCounts },
        total: { ...initialStageCounts },
      };
    } else {
      // Supervisor, Branch, Admin, etc.
      responseStructure = {
        direct: { ...initialStageCounts },
        rm: { ...initialStageCounts },
        ap: { ...initialStageCounts },
        total: { ...initialStageCounts },
      };
    }

    // Map aggregation results to structure
    results.forEach((item) => {
      const channelKey = item._id.channel.toLowerCase(); // DIRECT -> direct
      const stage = item._id.stage;
      const count = item.count;

      // Only populate if the channel is part of the response structure (security check)
      if (
        responseStructure[channelKey] &&
        responseStructure[channelKey][stage] !== undefined
      ) {
        responseStructure[channelKey][stage] = count;
      }
    });

    // Calculate Totals
    stagesList.forEach((stage) => {
      let stageTotal = 0;
      Object.keys(responseStructure).forEach((channel) => {
        if (channel !== "total") {
          stageTotal += responseStructure[channel][stage] || 0;
        }
      });
      responseStructure.total[stage] = stageTotal;
    });

    res.status(200).json({
      status: "success",
      data: responseStructure,
    });
  } catch (error) {
    console.error("Error in getUserDashboardSummary:", error);
    res
      .status(500)
      .json({ status: "failed", message: "Internal server error" });
  }
};

/**
 * Get User List by Stage and Channel
 */
export const getUserListByDashboardStage = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { startDate, endDate, channel, stage } = req.query;

    if (!channel || !stage) {
      return res
        .status(400)
        .json({ status: "failed", message: "Channel and Stage are required" });
    }

    const adminUserId = new mongoose.Types.ObjectId(userId);
    const adminUser = await AdminUser.findById(adminUserId);

    if (!adminUser) {
      return res
        .status(404)
        .json({ status: "failed", message: "Admin user not found" });
    }

    // 1. Build Match Query (Same as Summary)
    let matchQuery = {
      userStatus: { $ne: "none" },
      PAN: { $exists: true, $ne: null },
    };

    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) {
        const [day, month, year] = startDate.split("/");
        const startDateTime = new Date(`${year}-${month}-${day}`);
        startDateTime.setHours(0, 0, 0, 0);
        startDateTime.setHours(startDateTime.getHours() - 5);
        startDateTime.setMinutes(startDateTime.getMinutes() - 30);
        matchQuery.createdAt.$gte = startDateTime;
      }
      if (endDate) {
        const [day, month, year] = endDate.split("/");
        const endDateTime = new Date(`${year}-${month}-${day}`);
        endDateTime.setHours(23, 59, 59, 999);
        endDateTime.setHours(endDateTime.getHours() - 5);
        endDateTime.setMinutes(endDateTime.getMinutes() - 30);
        matchQuery.createdAt.$lte = endDateTime;
      }
    }

    const roleQuery = await buildRoleScopingQuery(role, adminUserId, adminUser);
    if (roleQuery === null) {
      return res
        .status(403)
        .json({ status: "failed", message: "Unauthorized role" });
    }
    Object.assign(matchQuery, roleQuery);

    // 2. Aggregation to Filter by Computed Fields
    const pipeline = [
      { $match: matchQuery },
      {
        $addFields: {
          channel: {
            $switch: {
              branches: [
                {
                  case: { $ifNull: ["$authorisedPerson._id", false] },
                  then: "AP",
                },
                {
                  case: { $ifNull: ["$relationshipManager._id", false] },
                  then: "RM",
                },
              ],
              default: "DIRECT",
            },
          },
          stage: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$userStatus", "completed"] },
                  then: "Sent to B.O",
                },
                {
                  case: { $eq: ["$userStatus", "rejected"] },
                  then: "Rejection",
                },
                {
                  case: {
                    $eq: ["$digitalSignatureContract.signedByClient", true],
                  },
                  then: "Esign",
                },
                {
                  case: { $eq: ["$ipv_details.verificationStatus", true] },
                  then: "IPV",
                },
                {
                  case: {
                    $ifNull: ["$bank_account_details.account_number", false],
                  },
                  then: "Bank",
                },
                {
                  case: {
                    $ne: [{ $ifNull: ["$address.addressLine1", ""] }, ""],
                  },
                  then: "Address",
                },
                { case: true, then: "Prospects" },
              ],
              default: "Prospects",
            },
          },
        },
      },
      {
        $match: {
          ...(channel !== "ALL" && { channel: channel }),
          stage: stage,
        },
      },
      {
        $project: {
          _id: 1,
          name: "$name.fullName",
          email: 1,
          mobileNumber: 1,
          PAN: 1,
          clientCode: 1,
          createdAt: 1,
        },
      },
    ];

    const users = await User.aggregate(pipeline);

    const formattedUsers = users.map((user) => ({
      ...user,
      createdAt: formatToIST(user.createdAt)?.split(" ")[0] || user.createdAt,
    }));

    res.status(200).json({
      status: "success",
      count: formattedUsers.length,
      data: formattedUsers,
    });
  } catch (error) {
    console.error("Error in getUserListByDashboardStage:", error);
    res
      .status(500)
      .json({ status: "failed", message: "Internal server error" });
  }
};

/**
 * Get Onboarding Graph Data
 * - Graph: Weekly/Monthly (Day-wise), Yearly (Month-wise)
 * - Stats: Today, Week, Month, Financial Year (Independent of filter)
 */
export const getOnboardingGraph = async (req, res) => {
  try {
    const { filter } = req.query; // weekly, monthly, yearly

    // --- Helper for Date Calculation ---
    // We need to work with IST dates because "Today", "This Week" are based on IST.
    // However, MongoDB stores dates in UTC (usually).
    // If the server stores dates as UTC representing the actual time:
    // We need to convert IST start times to UTC.
    // IST = UTC + 5:30.
    // So 00:00 IST = (Previous Day) 18:30 UTC.

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);

    const getUTCFromIST = (istDate) => {
      return new Date(istDate.getTime() - istOffset);
    };

    // --- 1. Calculate Ranges for Stats (Independent of Filter) ---

    // Today (IST 00:00:00)
    const todayStartIST = new Date(nowIST);
    todayStartIST.setUTCHours(0, 0, 0, 0);
    const todayStartUTC = getUTCFromIST(todayStartIST);

    // This Week (IST Monday 00:00:00)
    const weekStartIST = new Date(nowIST);
    const day = weekStartIST.getUTCDay(); // 0 (Sun) - 6 (Sat)
    // Adjust to Monday (1)
    const diff = weekStartIST.getUTCDate() - day + (day === 0 ? -6 : 1);
    weekStartIST.setUTCDate(diff);
    weekStartIST.setUTCHours(0, 0, 0, 0);
    const weekStartUTC = getUTCFromIST(weekStartIST);

    // This Month (IST 1st 00:00:00)
    const monthStartIST = new Date(nowIST);
    monthStartIST.setUTCDate(1);
    monthStartIST.setUTCHours(0, 0, 0, 0);
    const monthStartUTC = getUTCFromIST(monthStartIST);

    // This Financial Year (IST April 1st 00:00:00)
    const fyStartIST = new Date(nowIST);
    // If current month is Jan(0), Feb(1), Mar(2) -> FY started previous year April
    if (fyStartIST.getUTCMonth() < 3) {
      fyStartIST.setUTCFullYear(fyStartIST.getUTCFullYear() - 1);
    }
    fyStartIST.setUTCMonth(3); // April
    fyStartIST.setUTCDate(1);
    fyStartIST.setUTCHours(0, 0, 0, 0);
    const fyStartUTC = getUTCFromIST(fyStartIST);

    // Match Criteria: Onboarded = Application Submitted (Signed)
    const matchCriteria = {
      "digitalSignatureContract.signedByClient": true,
      "digitalSignatureContract.signedTime": { $ne: null },
    };

    // --- 2. Calculate Graph Ranges (Based on Filter) ---
    let graphStartUTC, graphEndUTC;
    let groupByFormat; // Use ISO format for correct sorting in MongoDB

    if (filter === "monthly") {
      // Current Month Daily Data
      graphStartUTC = monthStartUTC;
      const monthEndIST = new Date(monthStartIST);
      monthEndIST.setUTCMonth(monthEndIST.getUTCMonth() + 1);
      graphEndUTC = getUTCFromIST(monthEndIST);
      groupByFormat = "%Y-%m-%d";
    } else if (filter === "yearly") {
      // Current Financial Year Monthly Data
      graphStartUTC = fyStartUTC;
      const fyEndIST = new Date(fyStartIST);
      fyEndIST.setUTCFullYear(fyEndIST.getUTCFullYear() + 1);
      graphEndUTC = getUTCFromIST(fyEndIST);
      groupByFormat = "%Y-%m";
    } else {
      // Default: Weekly (Current Week Daily Data)
      graphStartUTC = weekStartUTC;
      const weekEndIST = new Date(weekStartIST);
      weekEndIST.setUTCDate(weekEndIST.getUTCDate() + 7);
      graphEndUTC = getUTCFromIST(weekEndIST);
      groupByFormat = "%Y-%m-%d";
    }

    // --- 3. Execute Aggregation ---
    const [statsResult, graphResult] = await Promise.all([
      User.aggregate([
        { $match: matchCriteria },
        {
          $facet: {
            today: [
              {
                $match: {
                  "digitalSignatureContract.signedTime": {
                    $gte: todayStartUTC,
                  },
                },
              },
              { $count: "count" },
            ],
            week: [
              {
                $match: {
                  "digitalSignatureContract.signedTime": { $gte: weekStartUTC },
                },
              },
              { $count: "count" },
            ],
            month: [
              {
                $match: {
                  "digitalSignatureContract.signedTime": {
                    $gte: monthStartUTC,
                  },
                },
              },
              { $count: "count" },
            ],
            year: [
              {
                $match: {
                  "digitalSignatureContract.signedTime": { $gte: fyStartUTC },
                },
              },
              { $count: "count" },
            ],
          },
        },
      ]),
      User.aggregate([
        {
          $match: {
            ...matchCriteria,
            "digitalSignatureContract.signedTime": {
              $gte: graphStartUTC,
              $lt: graphEndUTC,
            },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: groupByFormat,
                date: "$digitalSignatureContract.signedTime",
                timezone: "+05:30",
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const stats = {
      today: statsResult[0].today[0]?.count || 0,
      thisWeek: statsResult[0].week[0]?.count || 0,
      thisMonth: statsResult[0].month[0]?.count || 0,
      thisFinancialYear: statsResult[0].year[0]?.count || 0,
    };

    // Helper to format date string based on filter
    const formatDisplayDate = (dateStr) => {
      if (filter === "yearly") {
        // Input: "YYYY-MM" (e.g. "2023-04")
        // Output: "April, 2023"
        const [year, month] = dateStr.split("-");
        const date = new Date(year, month - 1); // Month is 0-indexed in JS Date
        const monthName = date.toLocaleString("default", { month: "long" });
        return `${monthName}, ${year}`;
      } else {
        // Input: "YYYY-MM-DD" (e.g. "2023-04-01")
        // Output: "DD/MM/YYYY"
        const [year, month, day] = dateStr.split("-");
        return `${day}/${month}/${year}`;
      }
    };

    res.status(200).json({
      status: "success",
      data: {
        stats,
        graphData: graphResult.map((g) => ({
          date: formatDisplayDate(g._id),
          count: g.count,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching onboarding graph:", error);
    res
      .status(500)
      .json({ status: "failed", message: "Internal server error" });
  }
};

/**
 * Get Comprehensive Role Dashboard Summary
 * Supports: Supervisor, Relationship Manager, Authorised Person, Admin, Branch, Scrutiny Officer
 */
export const getRoleDashboardSummary = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { previewRole } = req.query;

    const adminUserId = new mongoose.Types.ObjectId(userId);
    const adminUser = await AdminUser.findById(adminUserId);

    if (!adminUser) {
      return res.status(404).json({ status: "failed", message: "Admin user not found" });
    }

    // Allow Admin & Supervisor to preview other dashboards
    let effectiveRole = role;
    if (previewRole && ["Admin", "Supervisor"].includes(role)) {
      effectiveRole = previewRole;
    }

    // --- Date Calculations in IST ---
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);

    const getUTCFromIST = (istDate) => new Date(istDate.getTime() - istOffset);

    // Today Start
    const todayStartIST = new Date(nowIST);
    todayStartIST.setUTCHours(0, 0, 0, 0);
    const todayStartUTC = getUTCFromIST(todayStartIST);

    // Week Start (Monday)
    const weekStartIST = new Date(nowIST);
    const day = weekStartIST.getUTCDay();
    const diff = weekStartIST.getUTCDate() - day + (day === 0 ? -6 : 1);
    weekStartIST.setUTCDate(diff);
    weekStartIST.setUTCHours(0, 0, 0, 0);
    const weekStartUTC = getUTCFromIST(weekStartIST);

    // Month Start (1st of month)
    const monthStartIST = new Date(nowIST);
    monthStartIST.setUTCDate(1);
    monthStartIST.setUTCHours(0, 0, 0, 0);
    const monthStartUTC = getUTCFromIST(monthStartIST);

    // 24 Hours Ago (for Alerts)
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // --- Build Base Scoped Match Query ---
    let scopedMatch = {
      panConfirmed: true,
      userStatus: { $ne: "none" },
    };

    const roleQuery = await buildRoleScopingQuery(effectiveRole, adminUserId, adminUser);
    if (roleQuery && Object.keys(roleQuery).length > 0) {
      Object.assign(scopedMatch, roleQuery);
    }

    // --- Execute Faceted Aggregation for Complete Metrics ---
    const [facets] = await User.aggregate([
      { $match: scopedMatch },
      {
        $facet: {
          totalCount: [{ $count: "val" }],
          todayCount: [
            { $match: { createdAt: { $gte: todayStartUTC } } },
            { $count: "val" },
          ],
          weekCount: [
            { $match: { createdAt: { $gte: weekStartUTC } } },
            { $count: "val" },
          ],
          monthCount: [
            { $match: { createdAt: { $gte: monthStartUTC } } },
            { $count: "val" },
          ],
          verifiedTotal: [
            { $match: { userStatus: { $in: ["approved", "completed"] } } },
            { $count: "val" },
          ],
          accountsOpenToday: [
            { $match: { userStatus: "completed", updatedAt: { $gte: todayStartUTC } } },
            { $count: "val" },
          ],
          accountsOpenWeek: [
            { $match: { userStatus: "completed", updatedAt: { $gte: weekStartUTC } } },
            { $count: "val" },
          ],
          accountsOpenMonth: [
            { $match: { userStatus: "completed", updatedAt: { $gte: monthStartUTC } } },
            { $count: "val" },
          ],
          overallRejections: [
            { $match: { userStatus: "rejected" } },
            { $count: "val" },
          ],
          stages: [
            { $group: { _id: "$userStatus", count: { $sum: 1 } } },
          ],
          gender: [
            {
              $project: {
                g: {
                  $toLower: {
                    $ifNull: ["$personal_details.gender", { $ifNull: ["$gender", "other"] }],
                  },
                },
              },
            },
            { $group: { _id: "$g", count: { $sum: 1 } } },
          ],
          utmSources: [
            {
              $project: {
                utm: {
                  $ifNull: [
                    "$utm_source",
                    { $ifNull: ["$campaign", { $ifNull: ["$leadSource", "Direct"] }] },
                  ],
                },
              },
            },
            { $group: { _id: "$utm", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 8 },
          ],
          occupations: [
            {
              $project: {
                occ: {
                  $ifNull: [
                    "$occupation",
                    { $ifNull: ["$profile_details.occupation", "Not Specified"] },
                  ],
                },
              },
            },
            { $group: { _id: "$occ", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 7 },
          ],
          branches: [
            {
              $match: { "branch.name": { $exists: true, $ne: null, $ne: "" } },
            },
            {
              $group: {
                _id: "$branch.name",
                code: { $first: "$branch.code" },
                count: { $sum: 1 },
                completed: {
                  $sum: { $cond: [{ $eq: ["$userStatus", "completed"] }, 1, 0] },
                },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 6 },
          ],
          rejectionReasons: [
            { $match: { userStatus: "rejected" } },
            {
              $project: {
                reason: {
                  $ifNull: [
                    "$rejectionReason",
                    {
                      $ifNull: [
                        "$digitalSignatureContract.rejectionReason",
                        {
                          $ifNull: [
                            "$pan_card_details.rejectionReason",
                            {
                              $ifNull: [
                                "$bank_account_details.rejectionReason",
                                "Document / Signature Discrepancy",
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            { $group: { _id: "$reason", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 6 },
          ],
          delayedLeads: [
            {
              $match: {
                userStatus: "pending",
                createdAt: { $lt: twentyFourHoursAgo },
              },
            },
            { $count: "val" },
          ],
          pushQueue: [
            {
              $group: {
                _id: {
                  $cond: [
                    { $eq: ["$userStatus", "completed"] },
                    "completed",
                    {
                      $cond: [
                        { $eq: ["$userStatus", "approved"] },
                        "pendingPush",
                        "inProgress",
                      ],
                    },
                  ],
                },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    // --- Format Stages with Exact UI Attributes ---
    const totalLeads = facets.totalCount[0]?.val || 0;
    const stageCounts = {};
    (facets.stages || []).forEach((s) => {
      stageCounts[s._id] = s.count;
    });

    const definedStages = [
      { key: "pending", label: "Pending", color: "#94a3b8", gradient: "linear-gradient(90deg, #94a3b8, #cbd5e1)" },
      { key: "esigned", label: "eSign Completed", color: "#06b6d4", gradient: "linear-gradient(90deg, #06b6d4, #22d3ee)" },
      { key: "approved", label: "Approved", color: "#6366f1", gradient: "linear-gradient(90deg, #6366f1, #818cf8)" },
      { key: "rejected", label: "Rejected", color: "#ef4444", gradient: "linear-gradient(90deg, #ef4444, #f87171)" },
      { key: "completed", label: "Completed", color: "#10b981", gradient: "linear-gradient(90deg, #10b981, #34d399)" },
    ];

    const formattedStages = definedStages.map((st) => {
      const count = stageCounts[st.key] || 0;
      const percentage = totalLeads > 0 ? Number(((count / totalLeads) * 100).toFixed(1)) : 0;
      return {
        ...st,
        count,
        percentage,
      };
    });

    // --- Format Gender ---
    const genderMap = { male: 0, female: 0, other: 0 };
    (facets.gender || []).forEach((g) => {
      if (g._id === "male") genderMap.male = g.count;
      else if (g._id === "female") genderMap.female = g.count;
      else genderMap.other += g.count;
    });

    const genderData = [
      { name: "Male", value: genderMap.male, color: "#3b82f6" },
      { name: "Female", value: genderMap.female, color: "#ec4899" },
      { name: "Other", value: genderMap.other, color: "#8b5cf6" },
    ];

    // --- Format UTMs ---
    const utmData = (facets.utmSources || []).map((u) => ({
      source: u._id || "Direct",
      count: u.count,
    }));

    // --- Format Occupations (Human Readable) ---
    const occupationLabels = {
      privatesector: "Private Sector",
      privateSector: "Private Sector",
      "private sector": "Private Sector",
      publicsector: "Public Sector",
      publicSector: "Public Sector",
      "public sector": "Public Sector",
      governmentservice: "Government Service",
      governmentService: "Government Service",
      "government service": "Government Service",
      business: "Business",
      professional: "Professional",
      agriculturist: "Agriculturist",
      retired: "Retired",
      housewife: "House Wife",
      houseWife: "House Wife",
      "house wife": "House Wife",
      student: "Student",
      others: "Others",
      other: "Others",
      service: "Service",
      selfemployed: "Self Employed",
      selfEmployed: "Self Employed",
    };

    const getHumanOccupation = (val) => {
      if (!val || val === "Not Specified" || val === "null" || val === "undefined" || val === "not specified") {
        return "Not Specified";
      }
      const clean = String(val).trim();
      if (occupationLabels[clean]) return occupationLabels[clean];
      if (occupationLabels[clean.toLowerCase()]) return occupationLabels[clean.toLowerCase()];
      return clean
        .replace(/[-_]/g, " ")
        .replace(/([A-Z])/g, " $1")
        .replace(/\s+/g, " ")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
    };

    const occGroupMap = new Map();
    (facets.occupations || []).forEach((o) => {
      const humanName = getHumanOccupation(o._id);
      occGroupMap.set(humanName, (occGroupMap.get(humanName) || 0) + (o.count || 0));
    });

    const occPalette = ["#1e3a8a", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#64748b"];
    const occupationData = Array.from(occGroupMap.entries()).map(([name, count], idx) => ({
      name,
      value: count,
      color: occPalette[idx % occPalette.length],
    }));

    // --- Format Top Branches ---
    const topBranches = (facets.branches || []).map((b) => ({
      name: b._id,
      code: b.code || "BRN",
      count: b.count,
      completed: b.completed || 0,
      conversionRate: b.count > 0 ? ((b.completed / b.count) * 100).toFixed(1) + "%" : "0%",
    }));

    // --- Format Rejection Reasons ---
    const rejectionReasons = (facets.rejectionReasons || []).map((r) => ({
      reason: r._id,
      count: r.count,
    }));

    // --- Push Queue Stats ---
    const pushQueueMap = {};
    (facets.pushQueue || []).forEach((p) => {
      pushQueueMap[p._id] = p.count;
    });

    // --- Fetch Role Specific Extras ---
    let roleExtras = {};

    if (effectiveRole === "Relationship Manager") {
      const teamMemberIds = (adminUser?.teamMembers || []).map((m) => m._id);
      // Get APs under this RM with their lead volume
      const apList = await AdminUser.find({
        role: "Authorised Person",
        $or: [{ reportingTo: adminUserId }, { _id: { $in: teamMemberIds } }],
      }).select("name employeeId mobile");

      const apIds = apList.map((a) => a._id);
      const apCounts = await User.aggregate([
        { $match: { "authorisedPerson._id": { $in: apIds } } },
        {
          $group: {
            _id: "$authorisedPerson._id",
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$userStatus", "completed"] }, 1, 0] },
            },
          },
        },
      ]);

      const countMap = {};
      apCounts.forEach((c) => {
        countMap[String(c._id)] = c;
      });

      roleExtras.teamPerformance = apList.map((ap) => {
        const stats = countMap[String(ap._id)] || { count: 0, completed: 0 };
        return {
          id: ap._id,
          name: ap.name,
          employeeId: ap.employeeId,
          mobile: ap.mobile,
          count: stats.count,
          completed: stats.completed,
          conversionRate: stats.count > 0 ? ((stats.completed / stats.count) * 100).toFixed(1) + "%" : "0%",
        };
      });

      // Recent leads for RM
      const rmLeads = await User.find(scopedMatch)
        .select("name PAN mobileNumber mobile userStatus createdAt branch.name")
        .sort({ createdAt: -1 })
        .limit(6);
      roleExtras.recentLeads = rmLeads.map((u) => ({
        ...u.toObject(),
        mobile: u.mobileNumber || u.mobile || "",
      }));
    } else if (effectiveRole === "Authorised Person") {
      roleExtras.referralCode = adminUser.employeeId || adminUser.loginName;
      const apLeads = await User.find(scopedMatch)
        .select("name PAN mobileNumber mobile userStatus createdAt")
        .sort({ createdAt: -1 })
        .limit(6);
      roleExtras.recentLeads = apLeads.map((u) => ({
        ...u.toObject(),
        mobile: u.mobileNumber || u.mobile || "",
      }));
    } else if (effectiveRole === "Branch") {
      // Staff/RMs under this branch
      const branchId = adminUser.branch || adminUserId;
      const staffList = await AdminUser.find({ branch: branchId }).select("name role employeeId");
      roleExtras.branchStaff = staffList;
      const brLeads = await User.find(scopedMatch)
        .select("name PAN mobileNumber mobile userStatus createdAt")
        .sort({ createdAt: -1 })
        .limit(6);
      roleExtras.recentLeads = brLeads.map((u) => ({
        ...u.toObject(),
        mobile: u.mobileNumber || u.mobile || "",
      }));
    } else if (effectiveRole === "Scrutiny Officer") {
      roleExtras.allocatedCompletedToday = facets.accountsOpenToday[0]?.val || 0;
      roleExtras.pendingReviewQueue = await User.find({ userStatus: "pending", panConfirmed: true })
        .select("name PAN mobile createdAt rejectionDetails")
        .sort({ createdAt: 1 })
        .limit(8);
    }

    res.status(200).json({
      status: "success",
      data: {
        role: effectiveRole,
        kpis: {
          onboardingThisMonth: facets.monthCount[0]?.val || 0,
          onboardingThisWeek: facets.weekCount[0]?.val || 0,
          onboardingToday: facets.todayCount[0]?.val || 0,
          verifiedOnboarding: facets.verifiedTotal[0]?.val || 0,
          accountsOpenThisMonth: facets.accountsOpenMonth[0]?.val || 0,
          accountsOpenThisWeek: facets.accountsOpenWeek[0]?.val || 0,
          accountsOpenToday: facets.accountsOpenToday[0]?.val || 0,
          overallRejections: facets.overallRejections[0]?.val || 0,
        },
        stages: formattedStages,
        gender: genderData,
        utmSources: utmData,
        occupations: occupationData,
        topBranches: topBranches,
        rejectionReasons: rejectionReasons,
        requestStatus: [
          { label: "Leads", count: totalLeads },
          { label: "Converted", count: facets.verifiedTotal[0]?.val || 0 },
        ],
        upstreamSummary: {
          totalCompleted: pushQueueMap.completed || 0,
          pendingPush: pushQueueMap.pendingPush || 0,
          inProgress: pushQueueMap.inProgress || 0,
          kraVerified: facets.verifiedTotal[0]?.val || 0,
        },
        alerts: [
          {
            id: "delayed-kyc",
            title: "Delayed Review (> 24 Hrs)",
            count: facets.delayedLeads[0]?.val || 0,
            severity: "warning",
            description: "Applications waiting in pending state for more than 24 hours.",
          },
          {
            id: "rejection-escalation",
            title: "Overall Rejections",
            count: facets.overallRejections[0]?.val || 0,
            severity: "danger",
            description: "Applications flagged as rejected requiring review or re-kyc.",
          },
        ],
        ...roleExtras,
      },
    });
  } catch (error) {
    console.error("Error in getRoleDashboardSummary:", error);
    res.status(500).json({ status: "failed", message: "Internal server error" });
  }
};

/**
 * Get Onboarding Trend with Timeframe and Filter Scope
 */
export const getRoleOnboardingTrend = async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { filter = "ftm", type = "all", previewRole } = req.query; // ftd, ftw, ftm, fty

    const adminUserId = new mongoose.Types.ObjectId(userId);
    const adminUser = await AdminUser.findById(adminUserId);

    let effectiveRole = role;
    if (previewRole && ["Admin", "Supervisor"].includes(role)) {
      effectiveRole = previewRole;
    }

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);
    const getUTCFromIST = (istDate) => new Date(istDate.getTime() - istOffset);

    // Filter time range & format
    let graphStartUTC, graphEndUTC, groupByFormat;

    if (filter === "ftd" || filter === "daily") {
      // Past 14 Days
      const pastDaysIST = new Date(nowIST);
      pastDaysIST.setUTCDate(pastDaysIST.getUTCDate() - 14);
      pastDaysIST.setUTCHours(0, 0, 0, 0);
      graphStartUTC = getUTCFromIST(pastDaysIST);
      graphEndUTC = now;
      groupByFormat = "%Y-%m-%d";
    } else if (filter === "ftw" || filter === "weekly") {
      // Past 8 Weeks (group by day or week)
      const pastWeeksIST = new Date(nowIST);
      pastWeeksIST.setUTCDate(pastWeeksIST.getUTCDate() - 56);
      pastWeeksIST.setUTCHours(0, 0, 0, 0);
      graphStartUTC = getUTCFromIST(pastWeeksIST);
      graphEndUTC = now;
      groupByFormat = "%Y-%m-%d";
    } else if (filter === "fty" || filter === "yearly") {
      // Financial Year Monthly
      const fyStartIST = new Date(nowIST);
      if (fyStartIST.getUTCMonth() < 3) {
        fyStartIST.setUTCFullYear(fyStartIST.getUTCFullYear() - 1);
      }
      fyStartIST.setUTCMonth(3);
      fyStartIST.setUTCDate(1);
      fyStartIST.setUTCHours(0, 0, 0, 0);
      graphStartUTC = getUTCFromIST(fyStartIST);
      graphEndUTC = now;
      groupByFormat = "%Y-%m";
    } else {
      // Monthly (Current Month or past 30 days)
      const monthStartIST = new Date(nowIST);
      monthStartIST.setUTCDate(1);
      monthStartIST.setUTCHours(0, 0, 0, 0);
      graphStartUTC = getUTCFromIST(monthStartIST);
      graphEndUTC = now;
      groupByFormat = "%Y-%m-%d";
    }

    let matchCriteria = {
      panConfirmed: true,
      createdAt: { $gte: graphStartUTC, $lte: graphEndUTC },
    };

    if (type === "completed") {
      matchCriteria.userStatus = "completed";
    }

    const roleQuery = await buildRoleScopingQuery(effectiveRole, adminUserId, adminUser);
    if (roleQuery && Object.keys(roleQuery).length > 0) {
      Object.assign(matchCriteria, roleQuery);
    }

    const graphResult = await User.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupByFormat,
              date: "$createdAt",
              timezone: "+05:30",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const formatDisplayDate = (dateStr) => {
      if (groupByFormat === "%Y-%m") {
        const [year, month] = dateStr.split("-");
        const date = new Date(year, month - 1);
        return date.toLocaleString("default", { month: "short", year: "numeric" });
      } else {
        const [year, month, day] = dateStr.split("-");
        return `${day}/${month}`;
      }
    };

    res.status(200).json({
      status: "success",
      data: graphResult.map((g) => ({
        date: formatDisplayDate(g._id),
        rawDate: g._id,
        count: g.count,
      })),
    });
  } catch (error) {
    console.error("Error in getRoleOnboardingTrend:", error);
    res.status(500).json({ status: "failed", message: "Internal server error" });
  }
};

