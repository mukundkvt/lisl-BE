//For Admin
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AdminUser from '../models/AdminUser.js';
import { formatToIST } from '../utils/convertToIndianTimeDate.js';
import { info, error, logDbOperation, logDbError, logPerformance } from '../utils/logger.js';

// Function to generate JWT token with role
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user._id, 
      loginName: user.loginName,
      role: user.role
    },
    process.env.JWT_SECRET_KEY,
    { 
      expiresIn: '24h' 
    }
  );
};

// Login endpoint for admin users
// Register admin user
export const adminRegister = async (req, res) => {
  const startTime = Date.now();
  const { loginName } = req.body; // Capture loginName before try block
  try {
    const {
      name,
      employeeId,
      mobile,
      password
    } = req.body;



    // Input validation
    if (!loginName || !name || !employeeId || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }



    // Check if loginName or employeeId already exists (case-insensitive for loginName)
    const existingUser = await AdminUser.findOne({
      $or: [
        { loginName: { $regex: new RegExp(`^${loginName}$`, 'i') } },
        { employeeId }
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this login name or employee ID'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new admin user with role set to Admin
    const adminUser = new AdminUser({
      loginName,
      name,
      employeeId,
      role: 'Admin',
      mobile,
      password: hashedPassword,
      status: 'Active'
    });

    // Save user
    await adminUser.save();
    logDbOperation("create", "adminUsers", { id: adminUser._id });

    // Generate JWT token
    const token = generateToken(adminUser);

    // Prepare response - exclude password
    const userResponse = {
      _id: adminUser._id,
      loginName: adminUser.loginName,
      name: adminUser.name,
      employeeId: adminUser.employeeId,
      role: adminUser.role,
      mobile: adminUser.mobile,
      status: adminUser.status,
      lastLoginTime: adminUser.lastLoginTime
    };

    // Log successful registration
    info("Admin Registration Success", { loginName: adminUser.loginName, userId: adminUser._id });

    // Send response
    res.status(201).json({
      success: true,
      message: 'Admin user registered successfully',
      token,
      user: userResponse
    });

  } catch (err) {
    // Log error details
    error("Admin Registration Error", {
      message: err.message,
      stack: err.stack
    });
    
    // Log database error
    logDbError("register", "adminUsers", {
      message: err.message,
      stack: err.stack
    });

    // Send appropriate error response
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error: ' + Object.values(err.errors).map(e => e.message).join(', ')
      });
    }

    // For other errors
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  } finally {
    const duration = Date.now() - startTime;
    logPerformance("userRegister", duration, { loginName: loginName || 'unknown' });
  }
};

// User login endpoint for initial system setup
export const userLogin = async (req, res) => {
  const startTime = Date.now();
  const { loginName } = req.body; // Capture loginName before try block
  try {
    const { password } = req.body;

    // Input validation
    if (!loginName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Login name and password are required'
      });
    }

    // Find user by loginName (case-insensitive)
    const user = await AdminUser.findOne({
      loginName: { $regex: new RegExp(`^${loginName}$`, 'i') }
    });
    logDbOperation("findOne", "users", { loginName });
    

    if (!user) {
      error("Login Attempt Failed", {
        message: 'User not found',
        loginName
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials'
      });
    }

    // Check if user is active
    if (user.status !== 'Active') {
      error("Login Attempt Failed", {
        message: 'User account is not active',
        loginName,
        userId: user._id
      });
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Please contact an administrator.'
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      error("Login Attempt Failed", {
        message: 'Invalid password',
        loginName,
        userId: user._id
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid login credentials'
      });
    }

    // Update last login time in IST timezone
    const currentDate = new Date();
    user.lastLoginTime = currentDate;
    user.lastLoginAttempt = currentDate;
    await user.save();
    logDbOperation("save", "users", { id: user._id, loginName });

    // Generate JWT token
    const token = generateToken(user);

    // Prepare response - exclude password
    const userResponse = {
      _id: user._id,
      loginName: user.loginName, 
      name: user.name,
      employeeId: user.employeeId,
      role: user.role,
      branch: user.branch,
      reportingTo: user.reportingTo,
      mobile: user.mobile,
      status: user.status,
      lastLoginTime: formatToIST(currentDate)
    };

    // Log successful login
    info("User Login Success", { loginName, userId: user._id });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userResponse
    });

  } catch (err) {
    error("User Login Error", err);
    logDbError("login", "users", err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  } finally {
    const duration = Date.now() - startTime;
    logPerformance("userLogin", duration, { loginName: loginName || 'unknown' });
  }
};


export const checkAuthStatus = async (req, res) => {
  try {
    
    let token = req.headers.authorization || req.header('Authorization');
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authorization header missing' });
    }

   
    if (token.startsWith('Bearer ')) {
      token = token.split(' ')[1];
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // Fetch user details (exclude password)
    const user = await AdminUser.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, user });
  } catch (err) {
    error('checkAuthStatus Error', { message: err.message });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /admin/auth/change-password
// Allows a logged-in user to change their own password
export const changePassword = async (req, res) => {
  try {
    const { userId } = req.user;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Old password and new password are required' });
    }

    const adminUser = await AdminUser.findById(userId);
    if (!adminUser) {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }

    const isMatch = await bcrypt.compare(oldPassword, adminUser.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid old password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await AdminUser.findByIdAndUpdate(userId, { password: hashedPassword });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change Password Error:', err);
    res.status(500).json({ success: false, message: 'Server error while changing password' });
  }
};

// POST /admin/auth/change-password-by-admin
// Allows an admin to change any user's password
export const changePasswordByAdmin = async (req, res) => {
  try {
    const { role: adminRole } = req.user;

    if (adminRole !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Only Admin users can perform this action' });
    }

    const { loginName, password } = req.body;

    if (!loginName || !password) {
      return res.status(400).json({ success: false, message: 'Login name and new password are required' });
    }

    const userToUpdate = await AdminUser.findOne({ loginName: { $regex: new RegExp(`^${loginName}$`, 'i') } });
    if (!userToUpdate) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    userToUpdate.password = hashedPassword;
    await userToUpdate.save();

    res.json({ success: true, message: `Password for user '${loginName}' updated successfully` });
  } catch (err) {
    console.error('Change Password by Admin Error:', err);
    res.status(500).json({ success: false, message: 'Server error while changing password' });
  }
};



