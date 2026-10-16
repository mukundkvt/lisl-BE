//For User
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Referral from "../models/Referral.js";
import AdminUser from "../models/AdminUser.js";
import Branch from "../models/Branch.js";
import Scheme from "../models/Scheme.js";
import nodemailer from "nodemailer";
import { formatToIST, getISTDate } from "../utils/convertToIndianTimeDate.js";
import axios from "axios";
import { sendEmailWithFallback } from "../utils/mailHelper.js";

// Function to generate a random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000); // Generates a number between 100000 and 999999
};

// Function to send OTP

const buildSmsApiUrl = (mobileNumber, otp) => {
  const smsBaseUrl = String(process.env.FETCH_SMS_URL || "").replace(/\/+$/, "");
  const smsEndpoint = /\/send-sms$/i.test(smsBaseUrl)
    ? smsBaseUrl
    : `${smsBaseUrl}/send-sms`;
  const smsText = encodeURIComponent(
    `Your OTP for ekyc Registration with Lakshmishree is ${otp} and is valid for 15 minutes.`
  );
  return `${smsEndpoint}?key=${process.env.FETCH_SMS_KEY}&ph=${mobileNumber}&sndr=SHRIII&text=${smsText}`;
};

const sendMobileOTP = async (req, res) => {
  const { mobileNumber, referralid } = req.body;
  console.log(mobileNumber);
  try {
    let user = await User.findOne({ mobileNumber });
    
    // Check if user is an existing registered user with confirmed PAN
    if (user && user.panConfirmed && user.PAN) {
      return res.status(200).json({
        success: true,
        isExistingUser: true,
        message: "Existing user found. Please enter your PAN number to login.",
      });
    }

    // If user does not exist in our DB (new user), check if account already exists in SharePro
    if (!user) {
      try {
        const cleanMobile = String(mobileNumber || "").replace(/\D/g, "");
        const formattedMobile =
          cleanMobile.length > 10 ? cleanMobile.slice(-10) : cleanMobile;

        if (formattedMobile) {
          const shareproUrl = `${process.env.SHARE_PRO_API}/getUCCSUBCDbyMobile`;
          const shareproResponse = await axios.post(
            shareproUrl,
            {
              key: process.env.SHARE_PRO_API_KEY,
              cMobile: formattedMobile,
            },
            { timeout: 7000 }
          );

          if (
            Array.isArray(shareproResponse.data) &&
            shareproResponse.data.length > 0
          ) {
            return res.status(400).json({
              success: false,
              message:
                "From this mobile number an account already exists. Please use another mobile number.",
            });
          }
        }
      } catch (shareproError) {
        console.error(
          "Error checking SharePro mobile:",
          shareproError.message || shareproError
        );
      }
    }

    // Check for existing user and send limit
    if (user && user.otp.send_limit_time) {
        const timeDiff = Date.now() - new Date(user.otp.send_limit_time).getTime();
        const thirtyMinutesInMillis = 30 * 60 * 1000; // 30 minutes in milliseconds

        if (timeDiff < thirtyMinutesInMillis) {
            const remainingMinutes = Math.ceil((thirtyMinutesInMillis - timeDiff) / (60 * 1000));
            return res.status(429).json({
                message: `Maximum OTP limit reached. Please try after ${remainingMinutes} minutes.`
            });
        } else {
            // Reset counter and remove limit time if 30 minutes has passed
            user.otp.send_count = 0;
            user.otp.send_limit_time = null;
        }
    }

    const otp = process.env.NODE_ENV === 'production' ? generateOTP() : 550055;
    console.log(otp);

    // Send OTP via external API
    const smsApiUrl = buildSmsApiUrl(mobileNumber, otp);
    let smsLogRequest = `Your OTP for ekyc Registration with Lakshmishree is ${otp} and is valid for 15 minutes.`;
    let smsLogResponse = "";

    if (process.env.NODE_ENV === 'production') {
      try {
        const smsResponse = await axios.get(smsApiUrl);
        console.log("SMS API Response:", smsResponse.data);
        smsLogResponse = JSON.stringify(smsResponse.data);
        
        if (!smsResponse.data.success) {
          return res.status(500).json({
            success: false,
            message: "Failed to send OTP. Please try again later.",
            details: smsResponse.data,
          });
        }
      } catch (smsError) {
        console.error("Error sending SMS:", smsError.message || smsError);
        smsLogResponse = JSON.stringify({ error: smsError.message || String(smsError) });
        return res.status(500).json({
          success: false,
          message: "Error sending OTP. Please try again later.",
          error: smsError.message || smsError,
        });
      }
    }
    


    if (!user) {
      // Generate a unique LSID in increasing order (e.g. LS1, LS2, ...)
      let nextLSID = "LS1";

      try {
        // Fetch all existing LSIDs to find the true numerical maximum
        const existingUsers = await User.find(
          { lsid: { $exists: true, $ne: null } },
          { lsid: 1 }
        ).lean();

        let maxNumber = 0;
        for (const u of existingUsers) {
          if (u.lsid) {
            const num = parseInt(String(u.lsid).replace(/\D/g, ""), 10);
            if (!isNaN(num) && num > maxNumber) {
              maxNumber = num;
            }
          }
        }

        nextLSID = `LS${maxNumber + 1}`;

        // Verify uniqueness just in case
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 100;

        while (!isUnique && attempts < maxAttempts) {
          const existingUser = await User.findOne({
            lsid: { $regex: new RegExp(`^${nextLSID}$`, "i") },
          });

          if (!existingUser) {
            isUnique = true;
          } else {
            maxNumber++;
            nextLSID = `LS${maxNumber + 1}`;
            attempts++;
          }
        }

        // If we couldn't find a unique LSID after max attempts, use timestamp as fallback
        if (!isUnique) {
          nextLSID = `LS${Date.now()}`;
          console.log("Using timestamp-based LSID as fallback");
        }
      } catch (err) {
        console.error("Error generating LSID:", err);
        // Fallback to timestamp-based LSID in case of any error
        nextLSID = `LS${Date.now()}`;
      }

      // Create new user with initial counter and LSID
      user = new User({
        mobileNumber,
        lsid: nextLSID,
        otp: {
          otp,
          expiry: Date.now() + 300000, // 5 minutes
          send_count: 1, // Initialize counter
        },
        otpLogs: [
          {
            otp,
            mobile: mobileNumber,
            timestamp: getISTDate(new Date()),
          },
        ],
      });

      // If referralid is provided and user doesn't have one, apply it
      if (referralid && !user.referral) {
        const referral = await Referral.findOne({
          referralCode: referralid,
        }).populate("referrer._id scheme._id");
        if (referral) {
          user.referral = referral._id;
          user.referralCodeUsed = referral.referralCode;

          if (referral.referrer._id.role === "Authorised Person") {
            user.authorisedPerson = {
              _id: referral.referrer._id._id,
              name: referral.referrer._id.name,
              employeeId: referral.referrer._id.employeeId,
              mobile: referral.referrer._id.mobile,
            };
            if (referral.referrer._id.reportingTo) {
              const rm = await AdminUser.findById(
                referral.referrer._id.reportingTo
              ).populate("branch");
              if (rm) {
                user.relationshipManager = {
                  _id: rm._id,
                  name: rm.name,
                  employeeId: rm.employeeId,
                  mobile: rm.mobile,
                };
                if (rm.branch) {
                  user.branch = {
                    _id: rm.branch._id,
                    name: rm.branch.name,
                  };
                }
              }
            }
          } else if (referral.referrer._id.role === "Relationship Manager") {
            user.relationshipManager = {
              _id: referral.referrer._id._id,
              name: referral.referrer._id.name,
              employeeId: referral.referrer._id.employeeId,
              mobile: referral.referrer._id.mobile,
            };
            if (referral.referrer._id.branch) {
              const branch = await Branch.findById(
                referral.referrer._id.branch
              );
              if (branch) {
                user.branch = {
                  _id: branch._id,
                  name: branch.branchName,
                };
              }
            }
          }
          user.referredBy = {
            _id: referral.referrer._id._id,
            name: referral.referrer._id.name,
            employeeId: referral.referrer._id.employeeId,
            mobile: referral.referrer._id.mobile,
            role: referral.referrer._id.role,
          };
          user.appliedScheme = {
            _id: referral.scheme._id._id,
            schemeName: referral.scheme._id.schemeName,
          };
          referral.clicks = (referral.clicks || 0) + 1;
          await referral.save();
        }
      } else if (!referralid) {
        // If no referralid, apply the default scheme and set branch as Head
        let defaultScheme = await Scheme.findOne({ isDefault: true });

        // If no default scheme exists, use the first active scheme
        if (!defaultScheme) {
          defaultScheme = await Scheme.findOne({ isActive: true });
        }

        if (defaultScheme) {
          user.appliedScheme = {
            _id: defaultScheme._id,
            schemeName: defaultScheme.schemeName,
          };
          await user.save();
        }

        // Set branch as Head or VARANASI HO when no referral
        const headBranch = await Branch.findOne({ branchName: { $in: ["Head", "VARANASI HO"] } });
        if (headBranch) {
          user.branch = {
            _id: headBranch._id,
            name: headBranch.branchName,
          };
          await user.save();
        }
      }
    } else {
      // Update existing user and increment counter
      user.otp.otp = otp;
      user.otp.expiry = Date.now() + 300000;
      user.otp.send_count = (user.otp.send_count || 0) + 1;

      // Add to OTP logs
      user.otpLogs.push({
        otp,
        mobile: mobileNumber,
        timestamp: getISTDate(new Date()),
        request: smsLogRequest,
        response: smsLogResponse
      });

      // If referralid is provided and user doesn't have one, apply it
      if (referralid && !user.referral) {
        const referral = await Referral.findOne({
          referralCode: referralid,
        }).populate("referrer._id scheme._id");
        if (referral) {
          user.referral = referral._id;
          user.referralCodeUsed = referral.referralCode;

          if (referral.referrer._id.role === "Authorised Person") {
            user.authorisedPerson = {
              _id: referral.referrer._id._id,
              name: referral.referrer._id.name,
              employeeId: referral.referrer._id.employeeId,
              mobile: referral.referrer._id.mobile,
            };
            if (referral.referrer._id.reportingTo) {
              const rm = await AdminUser.findById(
                referral.referrer._id.reportingTo
              ).populate("branch");
              if (rm) {
                user.relationshipManager = {
                  _id: rm._id,
                  name: rm.name,
                  employeeId: rm.employeeId,
                  mobile: rm.mobile,
                };
                if (rm.branch) {
                  user.branch = {
                    _id: rm.branch._id,
                    name: rm.branch.name,
                  };
                }
              }
            }
          } else if (referral.referrer._id.role === "Relationship Manager") {
            user.relationshipManager = {
              _id: referral.referrer._id._id,
              name: referral.referrer._id.name,
              employeeId: referral.referrer._id.employeeId,
              mobile: referral.referrer._id.mobile,
            };
            if (referral.referrer._id.branch) {
              const branch = await Branch.findById(
                referral.referrer._id.branch
              );
              if (branch) {
                user.branch = {
                  _id: branch._id,
                  name: branch.name,
                };
              }
            }
          }
          user.referredBy = {
            _id: referral.referrer._id._id,
            name: referral.referrer._id.name,
            employeeId: referral.referrer._id.employeeId,
            mobile: referral.referrer._id.mobile,
            role: referral.referrer._id.role,
          };
          user.appliedScheme = {
            _id: referral.scheme._id._id,
            schemeName: referral.scheme._id.schemeName,
          };
        }
      } else if (!referralid) {
        // If no referralid, apply the default scheme and set branch as Head
        let defaultScheme = await Scheme.findOne({ isDefault: true });

        // If no default scheme exists, use the first active scheme
        if (!defaultScheme) {
          defaultScheme = await Scheme.findOne({ isActive: true });
          console.log("Using first active scheme instead:", defaultScheme);
        }

        if (defaultScheme) {
          user.appliedScheme = {
            _id: defaultScheme._id,
            schemeName: defaultScheme.schemeName,
          };
          await user.save();
        }

        // Set branch as Head or VARANASI HO when no referral
        const headBranch = await Branch.findOne({ branchName: { $in: ["Head", "VARANASI HO"] } });
        if (headBranch) {
          user.branch = {
            _id: headBranch._id,
            name: headBranch.branchName,
          };
          await user.save();
        }
      }

      // Check if limit reached
      if (user.otp.send_count >= 5) {
        user.otp.send_limit_time = getISTDate(new Date());
        await user.save();
        return res.status(429).json({
          message: "Maximum OTP limit reached. Please try after 30 minutes.",
        });
      }
    }

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { mobileNumber: user.mobileNumber },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "OTP sent successfully",
      token,
    });
  } catch (error) {
    res.status(500).json({ message: "Error sending OTP", error });
  }
};

// Function to resend OTP
const resendMobileOTP = async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify token and extract mobile number
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const mobileNumber = decoded.mobileNumber;

    // Find user with the mobile number
    const user = await User.findOne({ mobileNumber });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if send limit time exists and hasn't expired
    if (user.otp.send_limit_time) {
      const timeDiff =
        Date.now() - new Date(user.otp.send_limit_time).getTime();
      const fiveMinutesInMillis = 5 * 60 * 1000; // 5 minutes in milliseconds

      if (timeDiff < fiveMinutesInMillis) {
        const remainingMinutes = Math.ceil(
          (fiveMinutesInMillis - timeDiff) / (60 * 1000)
        );
        return res.status(429).json({
          message: `Maximum OTP limit reached. Please try after ${remainingMinutes} minutes.`,
        });
      } else {
        // Reset counter and remove limit time if 30 minutes has passed
        user.otp.send_count = 0;
        user.otp.send_limit_time = null;
      }
    }

    // Check if limit reached before attempting to send
    if (user.otp.send_count >= 5) {
      user.otp.send_limit_time = new Date();
      await user.save();
      return res.status(429).json({
        message: "Maximum OTP limit reached. Please try after 30 minutes.",
      });
    }

    // Generate new OTP
    const otp = process.env.NODE_ENV === 'production' ? generateOTP() : 550055;
    
    // We'll increment the counter only after successful SMS sending

    const smsApiUrl = buildSmsApiUrl(mobileNumber, otp);
    let smsLogRequest = `Your OTP for ekyc Registration with Lakshmishree is ${otp} and is valid for 15 minutes.`;
    let smsLogResponse = "";

    if (process.env.NODE_ENV === 'production') {
      try {
        const smsResponse = await axios.get(smsApiUrl);
        smsLogResponse = JSON.stringify(smsResponse.data);
        
        if (!smsResponse.data.success) {
          return res.status(500).json({
            success: false,
            message: "Failed to send OTP. Please try again later.",
            details: smsResponse.data,
          });
        }
        
        // Increment counter only after successful SMS sending
        if (!user.otp.send_count) {
          user.otp.send_count = 0;
        }
        user.otp.send_count += 1;
      } catch (smsError) {
        console.error("Error sending SMS:", smsError.message || smsError);
        smsLogResponse = JSON.stringify({ error: smsError.message || String(smsError) });
        return res.status(500).json({
          success: false,
          message: "Error sending OTP. Please try again later.",
          error: smsError.message || smsError,
        });
      }
    } else {
      if (!user.otp.send_count) {
        user.otp.send_count = 0;
      }
      user.otp.send_count += 1;
    }

    // Get current time in Indian timezone
    const indianTime = formatToIST(new Date());

    // Update OTP in database
    user.otp.otp = otp;
    user.otp.expiry = Date.now() + 300000; // 5 minutes expiry

    // Add to OTP logs
    user.otpLogs.push({
      otp,
      mobile: mobileNumber,
      timestamp: getISTDate(new Date()),
      request: smsLogRequest,
      response: smsLogResponse
    });

    await user.save();

    // Generate new JWT token
    const newToken = jwt.sign({ mobileNumber }, process.env.JWT_SECRET_KEY, {
      expiresIn: "1h",
    });

    // Here you would implement actual OTP sending logic
    console.log(otp);

    res.status(200).json({
      message: "OTP resent successfully",
      token: newToken,
      remainingAttempts: 5 - user.otp.send_count,
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ message: "Session expired" });
    }
    res
      .status(500)
      .json({ message: "Error resending OTP", error: error.message });
  }
};

const verifyMobileOTP = async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(" ")[1];
    const { otp } = req.body;

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify token and extract mobile number
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const mobileNumber = decoded.mobileNumber;

    // Find user with the mobile number
    const user = await User.findOne({ mobileNumber });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if OTP is expired
    if (Date.now() > user.otp.expiry) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Verify OTP
    if (user.otp.otp !== parseInt(otp)) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Mark mobile as verified
    user.mobileVerified = true;

    // Mark the last OTP in logs as verified
    if (user.otpLogs && user.otpLogs.length > 0) {
      const lastIndex = user.otpLogs.length - 1;
      user.otpLogs[lastIndex].isVerify = true;
    }

    // Clear OTP after successful verification
    user.otp.otp = null;
    user.otp.expiry = null;
    user.otp.send_count = 0;
    user.otp.send_limit_time = null;
    await user.save();

    res.status(200).json({
      message: "OTP verified successfully",
      emailVerified: Boolean(user.emailVerified),
      max_step_completed: user.max_step_completed || 0,
      userStatus: user.userStatus || "pending",
      rejectedSteps: user.rejectedSteps || [],
      rejectedStepsDone: user.rejectedStepsDone || [],
      approvals: user.approvals || {},
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ message: "Session expired" });
    }
    res
      .status(500)
      .json({ message: "Error verifying OTP", error: error.message });
  }
};

const sendEmailOTP = async (req, res) => {
    const { email } = req.body;
    
    try {
        // Get token from header and extract mobile number
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        // Verify token and extract mobile number
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const mobileNumber = decoded.mobileNumber;

        // Find user with mobile number
        let user = await User.findOne({ mobileNumber });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if send limit time exists and hasn't expired
        if (user.emailOtp?.send_limit_time) {
            const timeDiff = Date.now() - new Date(user.emailOtp.send_limit_time).getTime();
            const fiveMinutesInMillis = 5 * 60 * 1000;
            
            if (timeDiff < fiveMinutesInMillis) {
                const remainingMinutes = Math.ceil((fiveMinutesInMillis - timeDiff) / (60 * 1000));
                return res.status(429).json({ 
                    message: `Maximum OTP limit reached. Please try after ${remainingMinutes} minutes.`
                });
            } else {
                // Reset counter and remove limit time if 30 minutes has passed
                user.emailOtp.send_count = 0;
                user.emailOtp.send_limit_time = null;
            }
        }

        const otp = process.env.NODE_ENV === 'production' ? generateOTP() : 550055;
        console.log('Email OTP:', otp);
        
        // Get current time in Indian timezone
        const indianTime = formatToIST(new Date());

        // Set email and OTP details BEFORE saving
        user.email = email;
        user.emailOtp = {
            otp,
            expiry: Date.now() + 300000, // 5 minutes
            send_count: (user.emailOtp?.send_count || 0) + 1
        };
        
        // Add to email OTP logs
        user.emailOtpLogs = user.emailOtpLogs || [];
        user.emailOtpLogs.push({
            otp,
            email: email,
            timestamp: getISTDate(new Date())
        });

        // Check OTP limit
        if (user.emailOtp.send_count >= 5) {
            user.emailOtp.send_limit_time = new Date();
            await user.save();
            return res.status(429).json({ 
                message: 'Maximum OTP limit reached. Please try after 30 minutes.'
            });
        }

        // Save the user data AFTER setting all fields
        await user.save();

        // Send success response immediately
        res.status(200).json({ 
            message: 'Email OTP sent successfully',
            remainingAttempts: 5 - user.emailOtp.send_count
        });

        // Email content with professional formatting
        // Email content with professional formatting
        const mailOptions = {
            from: {
                name: 'Lakshmishree',
                address: process.env.SMTP_USER
            },
            to: email,
            subject: 'OTP Verification - Lakshmishree',
            text: `Your OTP for Lakshmishree account verification is: ${otp}. This OTP will expire in 5 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9f9f9;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="${process.env.BACKEND_SERVER}/assets/icons/fullLogo.png"
                             alt="Lakshmishree" 
                             style="max-width: 250px; height: auto; margin-bottom: 20px;"
                        />
                        <h2 style="color: #333;">Verify Your Email</h2>
                    </div>
                    <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <p style="margin-bottom: 20px;">Please use the following OTP to verify your email address:</p>
                        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 4px;">
                            <h1 style="color: #f05156; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
                        </div>
                        <p style="margin-top: 20px; color: #666;">This OTP will expire in 5 minutes.</p>
                        <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this OTP, please ignore this email.</p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
                        <p>© ${new Date().getFullYear()} Lakshmishree. All rights reserved.</p>
                    </div>
                </div>
            `,
            headers: {
                'X-Priority': '1',
                'X-MSMail-Priority': 'High',
                'Importance': 'high'
            },
            priority: 'high'
        };

        // Send email in background using fallback support
        sendEmailWithFallback(mailOptions).catch(error => {
            console.error('Background email sending failed:', error);
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Session expired' });
        }
        console.error('Email OTP Error:', error);
        res.status(500).json({ message: 'Error sending email OTP', error: error.message });
    }
};

const resendEmailOTP = async (req, res) => {
    try {
        // Get token from header
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        // Verify token and extract mobile number
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const mobileNumber = decoded.mobileNumber;

        // Find user
        const user = await User.findOne({ mobileNumber });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if email exists in database
        if (!user.email) {
            return res.status(400).json({ message: 'No email found for this user' });
        }

        // Check if send limit time exists and hasn't expired
        if (user.emailOtp?.send_limit_time) {
            const timeDiff = Date.now() - new Date(user.emailOtp.send_limit_time).getTime();
            const fiveMinutesInMillis = 5 * 60 * 1000;
            
            if (timeDiff < fiveMinutesInMillis) {
                const remainingMinutes = Math.ceil((fiveMinutesInMillis - timeDiff) / (60 * 1000));
                return res.status(429).json({ 
                    message: `Maximum OTP limit reached. Please try after ${remainingMinutes} minutes.`
                });
            } else {
                // Reset counter if 30 minutes passed
                user.emailOtp.send_count = 0;
                user.emailOtp.send_limit_time = null;
            }
        }

        const otp = process.env.NODE_ENV === 'production' ? generateOTP() : 550055;
        console.log('Email OTP:', otp);

        // Get current time in Indian timezone
        const indianTime = formatToIST(new Date());

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for other ports (STARTTLS)
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        const mailOptions = {
            from: {
                name: 'Lakshmishree',
                address: process.env.SMTP_USER
            },
            to: user.email, // Using email from database instead of request body
            subject: 'OTP Verification - Lakshmishree',
            text: `Your OTP for Lakshmishree account verification is: ${otp}. This OTP will expire in 5 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background-color: #f9f9f9;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <img src="${process.env.BACKEND_SERVER}/assets/icons/fullLogo.png"
                             alt="Lakshmishree" 
                             style="max-width: 250px; height: auto; margin-bottom: 20px;"
                        />
                        <h2 style="color: #333;">Verify Your Email</h2>
                    </div>
                    <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <p style="margin-bottom: 20px;">Please use the following OTP to verify your email address:</p>
                        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; border-radius: 4px;">
                            <h1 style="color: #f05156; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h1>
                        </div>
                        <p style="margin-top: 20px; color: #666;">This OTP will expire in 5 minutes.</p>
                        <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this OTP, please ignore this email.</p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
                        <p>© ${new Date().getFullYear()} Lakshmishree. All rights reserved.</p>
                    </div>
                </div>
            `,
            headers: {
                'X-Priority': '1',
                'X-MSMail-Priority': 'High',
                'Importance': 'high'
            },
            priority: 'high'
        };

        // Update user's email OTP information
        user.emailOtp = {
            ...user.emailOtp,
            otp,
            expiry: Date.now() + 300000, // 5 minutes
            send_count: (user.emailOtp?.send_count || 0) + 1
        };
        
        // Add to email OTP logs
        user.emailOtpLogs = user.emailOtpLogs || [];
        user.emailOtpLogs.push({
            otp,
            email: user.email,
            timestamp: getISTDate(new Date())
        });

        // Check if limit reached
        if (user.emailOtp.send_count >= 5  && false) {
            user.emailOtp.send_limit_time = new Date();
            await user.save();
            return res.status(429).json({ 
                message: 'Maximum OTP limit reached. Please try after 30 minutes.'
            });
        }

        // Send email and save user
        await sendEmailWithFallback(mailOptions);
        await user.save();

        res.status(200).json({ 
            message: 'Email OTP resent successfully',
            remainingAttempts: 5 - user.emailOtp.send_count
        });
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Session expired' });
        }
        console.error('Email OTP Error:', error);
        res.status(500).json({ message: 'Error resending email OTP', error: error.message });
    }
};

const verifyEmailOTP = async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(" ")[1];
    const { email, otp } = req.body;

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify token and extract mobile number
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const mobileNumber = decoded.mobileNumber;

    // Find user with the mobile number
    const user = await User.findOne({ mobileNumber });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if OTP is expired
    if (Date.now() > user.emailOtp.expiry) {
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Verify OTP
    if (user.emailOtp.otp !== parseInt(otp)) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Mark email as verified
    user.emailVerified = true;

    //Update step
    user.max_step_completed = 1;

    // Mark the last OTP in logs as verified
    if (user.emailOtpLogs && user.emailOtpLogs.length > 0) {
      const lastIndex = user.emailOtpLogs.length - 1;
      user.emailOtpLogs[lastIndex].isVerify = true;
    }

    // Clear email OTP data after successful verification
    user.emailOtp = {
      otp: null,
      expiry: null,
      send_count: 0,
      send_limit_time: null,
    };

    await user.save();

    // Generate new JWT token with 24 hours validity
    const newToken = jwt.sign(
      { mobileNumber: user.mobileNumber },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Email verified successfully",
      token: newToken,
      max_step_completed: user.max_step_completed || 1,
      userStatus: user.userStatus || "pending",
      rejectedSteps: user.rejectedSteps || [],
      rejectedStepsDone: user.rejectedStepsDone || [],
      approvals: user.approvals || {},
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({ message: "Session expired" });
    }
    res
      .status(500)
      .json({ message: "Error verifying email OTP", error: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { mobileNumber, PAN } = req.body;

    // Validate required fields
    if (!mobileNumber || !PAN) {
      return res.status(400).json({
        message: "Mobile number and PAN are required",
      });
    }

    // Find user by mobile number
    const user = await User.findOne({
      mobileNumber: mobileNumber,
      PAN: PAN,
    });

    // Check if user exists
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Check if PAN is confirmed
    if (!user.panConfirmed) {
      return res.status(403).json({
        message: "User is not registered - PAN not confirmed",
      });
    }

    const token = jwt.sign(
      { mobileNumber: user.mobileNumber },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "24h" }
    );

    // Prepare response data
    const responseData = {
      message: "Login successful",
      token: token,
      max_step_completed: user.max_step_completed || 0,
      userStatus: user.userStatus || "pending",
      rejectedSteps: user.rejectedSteps || [],
      rejectedStepsDone: user.rejectedStepsDone || [],
      approvals: user.approvals || {},
      name: {
        fullName: user.name.fullName,
        firstName: user.name.firstName,
        middleName: user.name.middleName,
        lastName: user.name.lastName,
      },
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Error during login",
      error: error.message,
    });
  }
};

const isLoggedIn = async (req, res) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(" ")[1];

    // Check if token is provided
    if (!token) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const mobileNumber = decoded.mobileNumber;

    // Find user by mobile number
    const user = await User.findOne({ mobileNumber });

    // Check if user exists
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Prepare response data
    const responseData = {
      message: "User is logged in",
      name: {
        fullName: user.name.fullName,
        firstName: user.name.firstName,
        middleName: user.name.middleName,
        lastName: user.name.lastName,
      },
      max_step_completed: user.max_step_completed || 0,
      userStatus: user.userStatus || "pending",
      rejectedSteps: user.rejectedSteps || [],
      rejectedStepsDone: user.rejectedStepsDone || [],
      approvals: user.approvals || {},
      kycType: user.kycType || null,
    };

    res.status(200).json(responseData);
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        message: "Invalid token",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
      });
    }

    console.error("IsLoggedIn error:", error);
    res.status(500).json({
      message: "Error checking login status",
      error: error.message,
    });
  }
};

export {
  sendMobileOTP,
  resendMobileOTP,
  verifyMobileOTP,
  sendEmailOTP,
  resendEmailOTP,
  verifyEmailOTP,
  loginUser,
  isLoggedIn,
};
