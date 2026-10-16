import AdminUser from "../models/AdminUser.js";
import User from "../models/User.js";
import DpId from "../models/DpId.js";
import { getISTDate } from "../utils/convertToIndianTimeDate.js";

export const updateApprovalStatus = async (req, res, next) => {
  try {
    const userId = req.params?.userId;
    const { status, section, reason } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // ✅ added await here (your code was missing it)
    const admin = await AdminUser.findById(req.user.userId).select(
      "_id name employeeId"
    );

    if (!admin) {
      return res
        .status(403)
        .json({ message: "Admin not found or unauthorized" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!user.approvals || !user.approvals[section]) {
      return res.status(400).json({ message: "Invalid section" });
    }

    // ✅ approval logic
    if (status === "approved") {
      user.approvals[section].status = "approved";
      user.approvals[section].autoApproved = false;
      user.approvals[section].approveBy = {
        _id: admin._id,
        name: admin.name,
        employeeId: admin.employeeId,
      };
      user.approvals[section].approveAt = getISTDate(new Date());
      user.approvals[section].rejectionReason = undefined;
      user.approvals[section].rejectedBy = undefined;
      user.approvals[section].rejectedAt = undefined;

      if (section === "ipv") {
        // Assign DP ID if not already assigned
        if (!user.dpId) {
          const freeDpId = await DpId.findOneAndUpdate(
            { is_used: false },
            {
              is_used: true,
              assignedTo: user._id,
              assignedAt: getISTDate(new Date()),
            },
            { new: true, sort: { createdAt: 1 } }
          );

          if (freeDpId) {
            user.dpId = freeDpId.dpId;
          }
        }

        // If DP ID is assigned, approve Demat
        if (user.dpId) {
          if (!user.approvals.demat) user.approvals.demat = {};
          
          user.approvals.demat.status = "approved";
          user.approvals.demat.autoApproved = false;
          user.approvals.demat.approveBy = {
            _id: admin._id,
            name: admin.name,
            employeeId: admin.employeeId,
          };
          user.approvals.demat.approveAt = getISTDate(new Date());
          user.approvals.demat.rejectionReason = undefined;
          user.approvals.demat.rejectedBy = undefined;
          user.approvals.demat.rejectedAt = undefined;
        }
      }

      // Ensure signature is auto-approved if signature was uploaded
      if (
        (user.signature?.signature_image || user.signature?.signature_pdf) &&
        user.approvals?.signature?.status !== "approved"
      ) {
        if (!user.approvals.signature) user.approvals.signature = {};
        user.approvals.signature.status = "approved";
        user.approvals.signature.autoApproved = true;
        user.approvals.signature.approveAt = getISTDate(new Date());
      }

      const allApproved = Object.values(user.approvals).every(
        (a) => a.status === "approved"
      );

      if (allApproved) {
        user.userStatus = "approved"; // mark user as approved
      }
    } else if (status === "rejected") {
      // If user was not previously in rejected state, start a fresh rejection cycle
      if (user.userStatus !== "rejected") {
        user.rejectedSteps = [];
        user.rejectedStepsDone = [];
      }

      if (section === "address") {
        user.rejectedSteps.push(2);
      } else if (section === "profile") {
        user.rejectedSteps.push(4);
      } else if (section === "bank") {
        user.rejectedSteps.push(3);
      } else if (section === "exchange") {
        user.rejectedSteps.push(5);
      } else if (section === "ipv") {
        user.rejectedSteps.push(6);
      } else if (section === "signature") {
        user.rejectedSteps.push(7);
      } else if (section === "digitalSign") {
        user.rejectedSteps.push(8);
      }
      if (section !== "digitalSign") {
        user.rejectedSteps.push(8);
      }
      if (user.rejectedSteps.length > 1) {
        user.rejectedSteps = [...new Set(user.rejectedSteps)].sort(
          (a, b) => a - b
        );
      }
      user.approvals[section].status = "rejected";
      user.approvals[section].autoApproved = false;
      user.approvals[section].rejectedBy = {
        _id: admin._id,
        name: admin.name,
        employeeId: admin.employeeId,
      };
      user.approvals[section].rejectedAt = getISTDate(new Date());
      user.approvals[section].rejectionReason = reason;
      user.approvals[section].approveBy = undefined;
      user.approvals[section].approveAt = undefined;

      // Track in rejectionHistory
      if (!user.rejectionHistory) user.rejectionHistory = [];
      user.rejectionHistory.push({
        field: section,
        status: "rejected",
        rejectionReason: reason,
        rejectedBy: {
          _id: admin._id,
          name: admin.name,
          employeeId: admin.employeeId,
        },
        rejectedAt: getISTDate(new Date()),
      });

      const anyRejected = Object.values(user.approvals).some(
        (a) => a.status === "rejected"
      );

      if (anyRejected) {
        user.userStatus = "rejected";
        user.rejectedStepsDone = [];
        // Clear previous signed contract so a fresh PDF can be generated with new details
        user.digitalSignatureContract = {
          signedByClient: false,
        };
        user.annexureJContract = {
          signedByClient: false,
        };
        if (user.contract) {
          user.contract.contractId = null;
          user.contract.contractStatus = null;
        }
      }
    }

    await user.save();

    return res.status(200).json({
      message: "User approval updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getUserApprovalStatus = async (req, res, next) => {
  try {
    const userId = req.params?.userId;

    const user = await User.findById(userId).select(
      "approvals createdAt clientCode referredBy name nameAsPerAddressProof isNameMatchPAN kycType"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const approvals = user.approvals || {};
    let allApproved = true;
    let lastApprovedAt = null;

    // Define the sections we care about
    const sections = [
      "address",
      "profile",
      "bank",
      "demat",
      "exchange",
      "ipv",
      "signature",
      "digitalSign",
    ];

    // Iterate through sections to check status and find last approval time
    for (const section of sections) {
      const sectionData = approvals[section];
      if (sectionData) {
        if (sectionData.status !== "approved") {
          allApproved = false;
        }

        if (sectionData.approveAt) {
          const approvalTime = new Date(sectionData.approveAt).getTime();
          if (
            !lastApprovedAt ||
            approvalTime > new Date(lastApprovedAt).getTime()
          ) {
            lastApprovedAt = sectionData.approveAt;
          }
        }
      } else {
        // If a section is missing, it's definitely not approved
        allApproved = false;
      }
    }

    const responseData = {
      success: true,
      allApproved: allApproved,
      lastApprovedAt: lastApprovedAt,
      addressStatus: approvals.address?.status || "pending",
      profileStatus: approvals.profile?.status || "pending",
      bankStatus: approvals.bank?.status || "pending",
      dematStatus: approvals.demat?.status || "pending",
      exchangeStatus: approvals.exchange?.status || "pending",
      ipvStatus: approvals.ipv?.status || "pending",
      signatureStatus: approvals.signature?.status || "pending",
      digitalSignStatus: approvals.digitalSign?.status || "pending",
      createdAt: user.createdAt,
      clientCode: user.clientCode,
      name: user.name,
      nameAsPerAddressProof: user.nameAsPerAddressProof,
      isNameMatchPAN: user.isNameMatchPAN,
      kycType: user.kycType,
    };

    if (user.referredBy && user.referredBy._id) {
      responseData.referredBy = {
        _id: user.referredBy._id,
        name: user.referredBy.name,
        employeeId: user.referredBy.employeeId,
        role: user.referredBy.role,
        mobile: user.referredBy.mobile,
      };
    }

    return res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};
