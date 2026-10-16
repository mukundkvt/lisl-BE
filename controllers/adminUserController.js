//For Admin

import AdminUser from "../models/AdminUser.js";
import User from "../models/User.js";
import Scheme from "../models/Scheme.js";
import Referral from "../models/Referral.js";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { sendEmailWithFallback } from "../utils/mailHelper.js";
// send Password change email message 
const sendEmailMessage = async (email, name, loginName, password) => {
  try {

    // Example call after update
    await sendEmailWithFallback({
      from: {
        name: "Lakshmishree",
        address: process.env.SMTP_USER,
      },
      to: email,
      subject: "Your Lakshmishree Account Details Updated",
      text: `Dear ${name},

Your Lakshmishree account has been updated successfully.

Updated Login Credentials:
- Email: ${email}
- Login Name: ${loginName}
- Password: ${password}

If you did not request this update, please contact Lakshmishree Support immediately.

Best regards,
Lakshmishree Team
`,
      html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9f9f9;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${process.env.BACKEND_SERVER}/assets/icons/fullLogo.png"
               alt="Lakshmishree" 
               style="max-width: 250px; height: auto; margin-bottom: 20px;"
          />
          <h2 style="color: #333;">Account Details Updated</h2>
        </div>
        <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your account has been updated successfully. Below are your updated login credentials:</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin-top: 15px;">
            <p style="margin: 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0; font-size: 16px;"><strong>Login Name:</strong> ${loginName}</p>
            <p style="margin: 0; font-size: 16px;"><strong>Password:</strong> ${password}</p>
          </div>
          
          <p style="margin-top: 20px; color: #666;">
            If you did not request this update, please contact Lakshmishree Support immediately.
          </p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Lakshmishree. All rights reserved.</p>
        </div>
      </div>
    `,
      headers: {
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        Importance: "high",
      },
      priority: "high",
    });
  } catch (error) {
    console.error("Update email sending failed:", error);
  }
};

// POST /admin/users
export const addUser = async (req, res) => {
  try {
    const { role: userRole } = req.user;

    // Only allow Admin users to add users
    if (userRole !== "Admin") {
      return res
        .status(403)
        .json({ message: "Only Admin users can add users" });
    }
    const {
      loginName,
      role,
      name,
      employeeId,
      mobile,
      email,
      password,
      branch,
      reportingTo,
    } = req.body;

    // Validate required fields
    if (
      !loginName ||
      !role ||
      !name ||
      !employeeId ||
      !mobile ||
      !email ||
      !password
    ) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });
    }

    // Validate mobile number format
    if (!/^\d{10}$/.test(mobile)) {
      return res
        .status(400)
        .json({ message: "Mobile number must be 10 digits" });
    }

    // Check for duplicates
    const loginExists = await AdminUser.findOne({ loginName });
    if (loginExists) {
      return res.status(409).json({ message: "Login name already exists" });
    }

    const empIdExists = await AdminUser.findOne({ employeeId });
    if (empIdExists) {
      return res.status(409).json({ message: "Employee ID already exists" });
    }

    // const emailExists = await AdminUser.findOne({ email });
    // if (emailExists) {
    //   return res.status(409).json({ message: 'Email already exists' });
    // }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new AdminUser
    const newUser = await AdminUser.create({
      loginName,
      role,
      name,
      employeeId,
      mobile,
      email,
      password: hashedPassword,
      branch: branch || null,
      reportingTo: reportingTo || null,
    });

    // If this is an Authorized Person and has a reporting manager (RM)
    if (role === "Authorised Person" && reportingTo) {
      // Add this user to the RM's team members
      await AdminUser.findByIdAndUpdate(reportingTo, {
        $push: {
          teamMembers: {
            _id: newUser._id,
            name: newUser.name,
            role: newUser.role,
          },
        },
      });
    }
    try {
      const mailOptions = (email, name, loginName, password) => ({
        from: {
          name: "Lakshmishree",
          address: process.env.SMTP_USER,
        },
        to: email,
        subject: "Welcome to Lakshmishree - Your Account Credentials",
        text: `Dear ${name},

Your Lakshmishree account has been created successfully.

Login Credentials:
- Email: ${email}
- Login Name: ${loginName}
- Password: ${password}

Please log in to your account and change your password immediately for security reasons.

Best regards,
Lakshmishree Team
`,
        html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9f9f9;">
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="${process.env.BACKEND_SERVER}/assets/icons/fullLogo.png"
               alt="Lakshmishree" 
               style="max-width: 250px; height: auto; margin-bottom: 20px;"
          />
          <h2 style="color: #333;">Welcome to Lakshmishree</h2>
        </div>
        <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <p>Dear <strong>${name}</strong>,</p>
          <p>Your account has been created successfully. Below are your login credentials:</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin-top: 15px;">
            <p style="margin: 0; font-size: 16px;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0; font-size: 16px;"><strong>Login Name:</strong> ${loginName}</p>
            <p style="margin: 0; font-size: 16px;"><strong>Password:</strong> ${password}</p>
          </div>
          
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            If you did not expect this email, please contact support immediately.
          </p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
          <p>© ${new Date().getFullYear()} Lakshmishree. All rights reserved.</p>
        </div>
      </div>
    `,
        headers: {
          "X-Priority": "1",
          "X-MSMail-Priority": "High",
          Importance: "high",
        },
        priority: "high",
      });

      await sendEmailWithFallback(mailOptions(email, name, loginName, password));
    } catch (error) {
      console.error("Email sending failed:", error);
    }

    res.status(201).json({ message: "Admin user created successfully" });
  } catch (err) {
    console.error("Add Admin User Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /admin/users
export const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const { role, search } = req.query;

    // Base filter
    let filter = {};

    // Filter by role
    if (role) {
      filter.role = role;
    }

    // Search filter (case-insensitive)
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { loginName: regex },
        { name: regex },
        { employeeId: regex },
        { role: regex },
        { mobile: regex },
      ];
    }

    // Count total matching documents
    const total = await AdminUser.countDocuments(filter);

    // Query users
    const users = await AdminUser.find(filter, { password: 0, __v: 0 })
      .populate("branch", "branchName")
      .populate("reportingTo", "loginName role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (err) {
    console.error("Get Users Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// PUT /admin/users/:id
export const updateUser = async (req, res) => {
  try {
    const { role: userRole } = req.user;

    // Only allow Admin users to update users
    if (userRole !== "Admin") {
      return res
        .status(403)
        .json({ message: "Only Admin users can update users" });
    }
    const { id } = req.params;
    const {
      loginName,
      role,
      name,
      employeeId,
      mobile,
      email,
      password,
      branch,
      reportingTo,
      status,
    } = req.body;

    const user = await AdminUser.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Store the previous reportingTo value for team member management
    const previousReportingTo = user.reportingTo;
    const isAuthorisedPerson =
      user.role === "Authorised Person" || role === "Authorised Person";

    if (loginName && loginName !== user.loginName) {
      const loginExists = await AdminUser.findOne({ loginName });
      if (loginExists) {
        return res.status(409).json({ message: "Login name already exists" });
      }
      user.loginName = loginName;
    }

    if (employeeId && employeeId !== user.employeeId) {
      const empIdExists = await AdminUser.findOne({ employeeId });
      if (empIdExists) {
        return res.status(409).json({ message: "Employee ID already exists" });
      }
      user.employeeId = employeeId;
    }

    if (email && email !== user.email) {
      const emailExists = await AdminUser.findOne({ email });
      if (emailExists) {
        return res.status(409).json({ message: "Email already exists" });
      }
      user.email = email;
    }

    if (role) user.role = role;
    if (name) user.name = name;
    if (mobile) {
      // Validate mobile number format
      if (!/^\d{10}$/.test(mobile)) {
        return res
          .status(400)
          .json({ message: "Mobile number must be 10 digits" });
      }
      user.mobile = mobile;
    }
    if (branch !== undefined) user.branch = branch;
    if (reportingTo !== undefined) user.reportingTo = reportingTo;
    if (status !== undefined) user.status = status; // FIX: now also allows false or 0

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }

    await user.save();
    if (password) {
      await sendEmailMessage(
        user.email,
        user.name,
        user.loginName,
        password
      );
    }

    // Handle team member management for Authorized Persons
    if (isAuthorisedPerson) {
      // If reporting manager has changed
      if (
        previousReportingTo &&
        (!reportingTo ||
          previousReportingTo.toString() !== reportingTo.toString())
      ) {
        // Remove from previous RM's team members
        await AdminUser.findByIdAndUpdate(previousReportingTo, {
          $pull: {
            teamMembers: { _id: user._id },
          },
        });
      }

      // If there's a new reporting manager
      if (
        reportingTo &&
        (!previousReportingTo ||
          previousReportingTo.toString() !== reportingTo.toString())
      ) {
        // Add to new RM's team members
        await AdminUser.findByIdAndUpdate(reportingTo, {
          $push: {
            teamMembers: {
              _id: user._id,
              name: user.name,
              role: user.role,
            },
          },
        });
      }
    }

    res.json({ message: "User updated successfully" });
  } catch (err) {
    console.error("Update User Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /admin/users/authorized-persons
// Get list of all authorized persons with name and id only
export const getRelationshipManagers = async (req, res) => {
  try {
    const relationshipManagers = await AdminUser.find(
      { role: "Relationship Manager", status: "Active" },
      "name _id"
    ).sort({ name: 1 });

    res.json({
      success: true,
      data: relationshipManagers,
    });
  } catch (err) {
    console.error("Get Relationship Managers Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch relationship managers",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// GET /admin/users/rm-and-ap
// Get list of all relationship managers and authorized persons
export const getRelationshipManagersAndAuthorizedPersons = async (req, res) => {
  try {
    const users = await AdminUser.find(
      {
        role: { $in: ["Relationship Manager", "Authorised Person"] },
        status: "Active",
      },
      "name _id role employeeId mobile branch reportingTo"
    )
      .populate("branch", "name")
      .populate("reportingTo", "name")
      .sort({ role: 1, name: 1 });

    res.json({
      success: true,
      data: users,
    });
  } catch (err) {
    console.error("Get RM and AP Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch relationship managers and authorized persons",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// GET /admin/users/branch/:branchId/rms
// Get list of Relationship Managers by branch ID
export const getRmByBranchId = async (req, res) => {
  try {
    const { branchId } = req.params;

    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: "Branch ID is required",
      });
    }

    // Find Relationship Managers for the given branch ID
    // Assuming 'branch' field in AdminUser directly stores the branch's ObjectId
    const rms = await AdminUser.find(
      { role: "Relationship Manager", branch: branchId },
      "name _id employeeId mobile"
    ).populate("branch", "branchName");

    return res.status(200).json({
      success: true,
      data: rms || [],
      message:
        rms && rms.length > 0
          ? "Relationship Managers fetched successfully"
          : "No Relationship Managers found for this branch",
    });
  } catch (err) {
    console.error("Get RM by Branch ID Error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch Relationship Managers by branch ID",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// GET /admin/users/check-login/:loginName
// Checks if a login name is already in use
export const checkLoginName = async (req, res) => {
  try {
    const { loginName } = req.params;

    const user = await AdminUser.findOne({
      loginName: new RegExp(`^${loginName}$`, "i"),
    });

    if (user) {
      return res.json({
        message: "Login name already exists",
        availableToRegister: false,
      });
    }

    res.json({
      message: "Login name is available",
      availableToRegister: true,
    });
  } catch (err) {
    console.error("Check Login Name Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while checking login name",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// GET /admin/users/check-employee-id/:employeeId
// Checks if an employee ID is already in use
export const checkEmployeeId = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const user = await AdminUser.findOne({
      employeeId: new RegExp(`^${employeeId}$`, "i"),
    });

    if (user) {
      return res.json({
        message: "Employee ID already exists",
        availableToRegister: false,
      });
    }

    res.json({
      message: "Employee ID is available",
      availableToRegister: true,
    });
  } catch (err) {
    console.error("Check Employee ID Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while checking employee ID",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// PATCH /admin/users/status
// Updates a user's status (Active/Inactive) - Admin only
export const updateUserStatus = async (req, res) => {
  try {
    // Check if the logged-in user is an Admin
    if (req.user.role !== "Admin") {
      return res
        .status(403)
        .json({ message: "Only Admin users can change user status" });
    }

    const { loginName, status } = req.body;

    // Validate input
    if (!loginName || !status) {
      return res
        .status(400)
        .json({ message: "Login name and status are required" });
    }

    if (status !== "Active" && status !== "Inactive") {
      return res
        .status(400)
        .json({ message: 'Status must be either "Active" or "Inactive"' });
    }

    // Find user by loginName and update status
    const user = await AdminUser.findOne({ loginName });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.status = status;
    await user.save();

    res.json({ message: `User '${loginName}' status updated to '${status}'` });
  } catch (err) {
    console.error("Update User Status Error:", err);
    res
      .status(500)
      .json({ message: "Server error while updating user status" });
  }
};

// GET /admin/users/counts-by-role
// Get the count of all users by role, excluding Admins
export const getUserCountsByRole = async (req, res) => {
  try {
    const rolesToExclude = ["Admin"];
    const roleCounts = await AdminUser.aggregate([
      {
        $match: {
          role: { $nin: rolesToExclude },
        },
      },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          role: "$_id",
          count: 1,
        },
      },
    ]);

    const countsObject = roleCounts.reduce((acc, { role, count }) => {
      acc[role] = count;
      return acc;
    }, {});

    const allRoles = AdminUser.schema
      .path("role")
      .enumValues.filter((role) => !rolesToExclude.includes(role));
    allRoles.forEach((role) => {
      if (!countsObject.hasOwnProperty(role)) {
        countsObject[role] = 0;
      }
    });

    res.json({
      success: true,
      data: countsObject,
    });
  } catch (err) {
    console.error("Get User Counts by Role Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user counts",
    });
  }
};

// Register user with referral code
export const registerWithReferral = async (req, res) => {
  try {
    const { mobileNumber, referralCode } = req.body;

    // Validate required fields
    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        error: "Mobile number is required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ mobileNumber });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "User with this mobile number already exists",
      });
    }

    let referralData = null;
    let appliedScheme = null;

    // If referral code provided, validate and get referral info
    if (referralCode) {
      referralData = await Referral.findOne({
        referralCode,
        isActive: true,
        expiryDate: { $gt: new Date() },
      })
        .populate("createdBy", "name employeeId role")
        .populate("scheme", "schemeName");

      if (!referralData) {
        return res.status(400).json({
          success: false,
          error: "Invalid or expired referral code",
        });
      }

      // Increment click count
      referralData.clickCount += 1;
      await referralData.save();

      appliedScheme = {
        _id: referralData.scheme._id,
        schemeName: referralData.scheme.schemeName,
      };
    } else {
      // No referral code - use default scheme
      let defaultScheme = await Scheme.findOne({ isDefault: true });

      // If no default scheme exists, use the first active scheme
      if (!defaultScheme) {
        defaultScheme = await Scheme.findOne({ isActive: true });
        console.log("Using first active scheme instead:", defaultScheme);
      }

      if (defaultScheme) {
        appliedScheme = {
          _id: defaultScheme._id,
          schemeName: defaultScheme.schemeName,
        };
      }
    }

    // Create new user
    const userData = {
      mobileNumber,
      referralCodeUsed: referralCode || null,
      appliedScheme,
    };

    // Add referral information if available
    if (referralData) {
      userData.referredBy = {
        _id: referralData.createdBy._id,
        name: referralData.createdBy.name,
        employeeId: referralData.createdBy.employeeId,
        role: referralData.createdBy.role,
      };
    }

    const newUser = await User.create(userData);

    // If referral was used, increment conversion count
    if (referralData) {
      referralData.conversionCount += 1;
      await referralData.save();
    }

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        userId: newUser._id,
        mobileNumber: newUser.mobileNumber,
        appliedScheme: newUser.appliedScheme,
        referredBy: newUser.referredBy || null,
        referralCodeUsed: newUser.referralCodeUsed || null,
      },
    });
  } catch (error) {
    console.error("Error registering user with referral:", error);
    res.status(500).json({
      success: false,
      error: "Failed to register user",
    });
  }
};

// Get user by referral code (for frontend validation)
export const validateReferralCode = async (req, res) => {
  try {
    const { referralCode } = req.params;

    const referral = await Referral.findOne({
      referralCode,
      isActive: true,
      expiryDate: { $gt: new Date() },
    })
      .populate("createdBy", "name employeeId role")
      .populate("scheme", "schemeName");

    if (!referral) {
      return res.status(404).json({
        success: false,
        error: "Invalid or expired referral code",
      });
    }

    res.json({
      success: true,
      data: {
        referralCode: referral.referralCode,
        campaignName: referral.campaignName,
        scheme: {
          _id: referral.scheme._id,
          schemeName: referral.scheme.schemeName,
        },
        referredBy: {
          name: referral.createdBy.name,
          employeeId: referral.createdBy.employeeId,
          role: referral.createdBy.role,
        },
        expiryDate: referral.expiryDate,
      },
    });
  } catch (error) {
    console.error("Error validating referral code:", error);
    res.status(500).json({
      success: false,
      error: "Failed to validate referral code",
    });
  }
};

// Get user's referral information
export const getUserReferralInfo = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select("referredBy referralCodeUsed appliedScheme")
      .populate("appliedScheme._id", "schemeName")
      .populate("referredBy._id", "name employeeId role");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        referredBy: user.referredBy || null,
        referralCodeUsed: user.referralCodeUsed || null,
        appliedScheme: user.appliedScheme || null,
      },
    });
  } catch (error) {
    console.error("Error fetching user referral info:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user referral information",
    });
  }
};
