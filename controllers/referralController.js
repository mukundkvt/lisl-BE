//For Admin
import Referral from '../models/Referral.js';
import Scheme from '../models/Scheme.js';
import AdminUser from '../models/AdminUser.js';
import mongoose from 'mongoose';

// Generate unique referral code
const generateReferralCode = (user, scheme) => {
  const rolePrefix = user.role === 'Authorised Person' ? 'AP' : 'RM';
  const employeeId = user.employeeId;
  const schemeId = scheme.schemeId.toString().padStart(3, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${rolePrefix}${employeeId}S${schemeId}${random}`;
};

// Create a new referral campaign
export const createReferral = async (req, res) => {
  try {
    const { campaignName, schemeId: rawSchemeId } = req.body;

    // Validate input: campaignName or schemeId must be provided
    if (!campaignName || !rawSchemeId) {
      return res.status(400).json({
        success: false,
        error: 'Campaign name or Scheme ID must be provided.'
      });
    }
    const schemeId = new mongoose.Types.ObjectId(rawSchemeId);
    const userId = req.user.userId;
    

    // Check if user has access to the scheme
    const user = await AdminUser.findById(userId).populate('assignedSchemes');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get the scheme
    const scheme = await Scheme.findById(schemeId);
    if (!scheme) {
      return res.status(404).json({
        success: false,
        error: 'Scheme not found'
      });
    }

    // Check if user has access to this scheme (or if it's default scheme)
    const hasAccess = scheme.isDefault || 
      user.assignedSchemes.some(s => s._id.toString() === scheme._id.toString());
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'You do not have access to this scheme'
      });
    }

    // Check if referral with same campaignName and scheme already exists
    const existingReferral = await Referral.findOne({ 
      'scheme._id': scheme._id,
      campaignName 
    });
    
    if (existingReferral) {
      return res.status(400).json({
        success: false,
        error: 'Campaign name and scheme combination already exists'
      });
    }

    // Generate unique referral code
    let referralCode;
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      referralCode = generateReferralCode(user, scheme);
      const existingReferralByCode = await Referral.findOne({ referralCode });
      if (!existingReferralByCode) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate unique referral code'
      });
    }

    // Create referral
    const newReferral = new Referral({
      referrer: {
        _id: user._id,
        name: user.name,
        employeeId: user.employeeId,
        role: user.role
      },
      scheme: {
        _id: scheme._id,
        schemeName: scheme.schemeName
      },
      referralCode,
      referralLink: referralCode, // Just the code, frontend will add base URL
      campaignName
    });

    await newReferral.save();

    res.status(201).json({
      success: true,
      data: newReferral
    });
  } catch (error) {
    console.error('Error creating referral:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create referral'
    });
  }
};

// Get referrals created by current user
export const getUserReferrals = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    const referrals = await Referral.find({ 'referrer._id': userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Referral.countDocuments({ 'referrer._id': userId });

    res.json({
      success: true,
      data: referrals,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching user referrals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch referrals'
    });
  }
};

// Get all referrals (Admin/Supervisor only)
export const getAllReferrals = async (req, res) => {
  try {
    const { page = 1, limit = 10, referrerId, schemeId } = req.query;
    const query = {};

    if (referrerId) {
      query['referrer._id'] = referrerId;
    }
    if (schemeId) {
      query['scheme._id'] = schemeId;
    }

    const referrals = await Referral.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Referral.countDocuments(query);

    res.json({
      success: true,
      data: referrals,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching all referrals:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch referrals'
    });
  }
};

// Track referral click (public endpoint)
export const trackReferralClick = async (req, res) => {
  try {
    const { code } = req.params;

    const referral = await Referral.findOne({ referralCode: code });
    if (!referral) {
      return res.status(404).json({
        success: false,
        error: 'Referral code not found'
      });
    }

    // Increment click count
    referral.clicks += 1;
    await referral.save();

    res.json({
      success: true,
      data: {
        referralCode: referral.referralCode,
        scheme: referral.scheme,
        referrer: {
          name: referral.referrer.name,
          role: referral.referrer.role
        }
      }
    });
  } catch (error) {
    console.error('Error tracking referral click:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track referral click'
    });
  }
};

// Get referral information (public endpoint)
export const getReferralInfo = async (req, res) => {
  try {
    const { code } = req.params;

    const referral = await Referral.findOne({ referralCode: code });
    if (!referral) {
      return res.status(404).json({
        success: false,
        error: 'Referral code not found'
      });
    }

    res.json({
      success: true,
      data: {
        referralCode: referral.referralCode,
        scheme: referral.scheme,
        referrer: {
          name: referral.referrer.name,
          role: referral.referrer.role
        }
      }
    });
  } catch (error) {
    console.error('Error fetching referral info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch referral information'
    });
  }
};

// Update referral
export const updateReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updates = req.body;

    // Find referral and check ownership
    const referral = await Referral.findById(id);
    if (!referral) {
      return res.status(404).json({
        success: false,
        error: 'Referral not found'
      });
    }

    // Check if user owns this referral or is admin/supervisor
    const isOwner = referral.referrer._id.toString() === userId.toString();
    const isAdminOrSupervisor = ['Admin', 'Supervisor'].includes(req.user.role);

    if (!isOwner && !isAdminOrSupervisor) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this referral'
      });
    }

    // Prevent updating certain fields
    delete updates.referralCode;
    delete updates.clicks;
    delete updates.conversions;
    delete updates.referrer;

    const updatedReferral = await Referral.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: updatedReferral
    });
  } catch (error) {
    console.error('Error updating referral:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update referral'
    });
  }
};

// Delete referral
export const deleteReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Find referral and check ownership
    const referral = await Referral.findById(id);
    if (!referral) {
      return res.status(404).json({
        success: false,
        error: 'Referral not found'
      });
    }

    // Check if user owns this referral or is admin/supervisor
    const isOwner = referral.referrer._id.toString() === userId.toString();
    const isAdminOrSupervisor = ['Admin', 'Supervisor'].includes(req.user.role);

    if (!isOwner && !isAdminOrSupervisor) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this referral'
      });
    }

    await Referral.findByIdAndDelete(id);

    res.json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error deleting referral:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete referral'
    });
  }
};

// Get referral statistics
export const getReferralStats = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const referral = await Referral.findById(id);
    if (!referral) {
      return res.status(404).json({
        success: false,
        error: 'Referral not found'
      });
    }

    // Check if user owns this referral or is admin/supervisor
    const isOwner = referral.referrer._id.toString() === userId.toString();
    const isAdminOrSupervisor = ['Admin', 'Supervisor'].includes(req.user.role);

    if (!isOwner && !isAdminOrSupervisor) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this referral stats'
      });
    }

    // Get conversion rate
    const conversionRate = referral.clicks > 0 ? 
      ((referral.conversions / referral.clicks) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        referralCode: referral.referralCode,
        clicks: referral.clicks,
        conversions: referral.conversions,
        conversionRate: `${conversionRate}%`,
        scheme: referral.scheme,
        createdAt: referral.createdAt
      }
    });
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch referral statistics'
    });
  }
};

// Process referral conversion (internal function)
export const processReferralConversion = async (referralCode, userId) => {
  try {
    const referral = await Referral.findOne({ referralCode });
    if (referral) {
      referral.conversions += 1;
      await referral.save();
      return referral;
    }
    return null;
  } catch (error) {
    console.error('Error processing referral conversion:', error);
    return null;
  }
};