//For ADmin

import AdminUser from '../models/AdminUser.js';
import Scheme from '../models/Scheme.js';

// Create a new scheme
export const createScheme = async (req, res) => {
  
  try {
    const { 
      schemeName,
      // Trading Brokerage
      cMSegmentTradingBrokerage,
      fOSegmentTradingBrokerage,
      currencyTradingBrokerage,
      mCXNCDEXTradingBrokerage,
      // Delivery Brokerage
      cMSegmentDeliveryBrokerage,
      fOSegmentDeliveryBrokerage,
      currencyDeliveryBrokerage,
      mCXNCDEXDeliveryBrokerage,
      // Minimum Brokerage
      cMSegmentMinimumBrokerageInPaisa,
      fOSegmentMinimumBrokerageInPaisa,
      currencyMinimumBrokerageInPaisa,
      mCXNCDEXMinimumBrokerageInPaisa,
      // Option Brokerage
      fOSegmentOptionBrokerageInRs,
      currencyOptionBrokerageInRs,
      mCXNCDEXOptionBrokerageInRs,
      // Share PRO Fields
      cBrkgBasketNSE,
      cBrkgBasketBSE,
      cBrkgBasketFO,
      nDelCMBrkg,
      nDelCMBrkgMin,
      nSqCMBrkg,
      nSqCMBrkgMin,
      nFutBrkg,
      nFutBrkgMin,
      isActive = true
    } = req.body;

    // Check if schemeName already exists
    const existingScheme = await Scheme.findOne({ schemeName: new RegExp(schemeName, 'i') });
    if (existingScheme) {
      return res.status(400).json({
        success: false,
        error: 'Scheme with this name already exists.'
      });
    }

    // Get the next schemeId
    const lastScheme = await Scheme.findOne().sort({ schemeId: -1 });
    const schemeId = lastScheme ? lastScheme.schemeId + 1 : 1;



    const newScheme = new Scheme({
      schemeId,
      schemeName,
      // Trading Brokerage
      cMSegmentTradingBrokerage,
      fOSegmentTradingBrokerage,
      currencyTradingBrokerage,
      mCXNCDEXTradingBrokerage,
      // Delivery Brokerage
      cMSegmentDeliveryBrokerage,
      fOSegmentDeliveryBrokerage,
      currencyDeliveryBrokerage,
      mCXNCDEXDeliveryBrokerage,
      // Minimum Brokerage
      cMSegmentMinimumBrokerageInPaisa,
      fOSegmentMinimumBrokerageInPaisa,
      currencyMinimumBrokerageInPaisa,
      mCXNCDEXMinimumBrokerageInPaisa,
      // Option Brokerage
      fOSegmentOptionBrokerageInRs,
      currencyOptionBrokerageInRs,
      mCXNCDEXOptionBrokerageInRs,
      // Share PRO Fields
      cBrkgBasketNSE,
      cBrkgBasketBSE,
      cBrkgBasketFO,
      nDelCMBrkg,
      nDelCMBrkgMin,
      nSqCMBrkg,
      nSqCMBrkgMin,
      nFutBrkg,
      nFutBrkgMin,
      isActive,
      createdBy: req.user.userId
    });

    await newScheme.save();
    
    res.status(201).json({
      success: true,
      data: newScheme
    });
  } catch (error) {
    console.error('Error creating scheme:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create scheme' 
    });
  }
};

// Get all schemes
export const getAllSchemes = async (req, res) => {
  try {
    const { isActive } = req.query;
    const query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const schemes = await Scheme.find(query, { schemeName: 1, _id: 1 })
      .sort({ schemeName: 1 });
    
    res.json({
      success: true,
      count: schemes.length,
      data: schemes
    });
  } catch (error) {
    console.error('Error fetching schemes:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch schemes' 
    });
  }
};

// Get scheme by ID
export const getSchemeById = async (req, res) => {
  try {
    const scheme = await Scheme.findById(req.params.id);
    
    if (!scheme) {
      return res.status(404).json({
        success: false,
        error: 'Scheme not found'
      });
    }
    
    res.json({
      success: true,
      data: scheme
    });
  } catch (error) {
    console.error('Error fetching scheme:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch scheme' 
    });
  }
};

// Update scheme
export const updateScheme = async (req, res) => {
  try {
    const updates = { ...req.body, updatedBy: req.user.userId };
    delete updates.schemeId; // Prevent updating schemeId
    
    const scheme = await Scheme.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!scheme) {
      return res.status(404).json({
        success: false,
        error: 'Scheme not found'
      });
    }
    
    res.json({
      success: true,
      data: scheme
    });
  } catch (error) {
    console.error('Error updating scheme:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update scheme' 
    });
  }
};


// Delete scheme
export const deleteScheme = async (req, res) => {
  try {
    const scheme = await Scheme.findOneAndDelete({ schemeId: req.params.id });
    
    if (!scheme) {
      return res.status(404).json({
        success: false,
        error: 'Scheme not found'
      });
    }
    
    res.json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error('Error deleting scheme:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete scheme' 
    });
  }
};

// Set default scheme
export const setDefaultScheme = async (req, res) => {
  try {
    const { id } = req.params;
    
    // First, unset any existing default
    await Scheme.updateMany(
      { _id: { $ne: id } },
      { $set: { isDefault: false } }
    );
    
    // Then set the new default
    const scheme = await Scheme.findByIdAndUpdate(
      id,
      { $set: { isDefault: true } },
      { new: true }
    );
    
    if (!scheme) {
      return res.status(404).json({
        success: false,
        error: 'Scheme not found'
      });
    }
    
    res.json({
      success: true,
      data: scheme
    });
  } catch (error) {
    console.error('Error setting default scheme:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to set default scheme' 
    });
  }
};

// Get schemes accessible to current user
export const getAccessibleSchemes = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await AdminUser.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get default scheme
    const defaultScheme = await Scheme.findOne({ isDefault: true }).select('_id schemeId schemeName');
    
    // Get user's accessible schemes
    const accessibleSchemeIds = user.assignedSchemes.map(s => s._id);
    const assignedSchemes = await Scheme.find({
      _id: { $in: accessibleSchemeIds },
      isActive: true
    }).select('_id schemeId schemeName');

    // Combine default scheme with accessible schemes
    let schemes = [...assignedSchemes];
    if (defaultScheme && !schemes.find(s => s._id.toString() === defaultScheme._id.toString())) {
      schemes.unshift(defaultScheme);
    }

    res.json({
      success: true,
      count: schemes.length,
      data: schemes
    });
  } catch (error) {
    console.error('Error fetching accessible schemes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch accessible schemes'
    });
  }
};



// Get all schemes with assignment status for a specific AdminUser
export const getSchemesWithAssignmentStatus = async (req, res) => {
  try {
    const { adminUserId } = req.params;

    // Validate adminUserId
    if (!adminUserId) {
      return res.status(400).json({ success: false, error: 'Admin User ID is required.' });
    }

    // Find the admin user to get their assigned schemes
    const adminUser = await AdminUser.findById(adminUserId).select('assignedSchemes');

    



    const assignedSchemeIds = adminUser.assignedSchemes.map(scheme => scheme._id.toString());


    

    // Get all schemes
    const allSchemes = await Scheme.find({}, '_id schemeName isDefault');

    // Map schemes to include assignment status
    const schemesWithStatus = allSchemes.map(scheme => ({
      _id: scheme._id,
      schemeName: scheme.schemeName,
      isAssigned: scheme.isDefault ? true : assignedSchemeIds.includes(scheme._id.toString())
    }));

    res.status(200).json({ success: true, data: schemesWithStatus });
  } catch (error) {
    console.error('Error fetching schemes with assignment status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch schemes with assignment status.' });
  }
};



// Update scheme assignment status for a specific AdminUser
export const updateSchemeAssignmentStatus = async (req, res) => {
  try {
    const { adminUserId } = req.params;
    const { schemes } = req.body; // Expecting an array of scheme objects



    // Validate inputs
    if (!adminUserId || !Array.isArray(schemes)) {
      return res.status(400).json({ success: false, error: 'Admin User ID and an array of schemes are required.' });
    }

    // Find the admin user
    const adminUser = await AdminUser.findById(adminUserId);

    if (!adminUser) {
      return res.status(404).json({ success: false, error: 'Admin User not found.' });
    }

    // Remove duplicates from existing assignedSchemes array
    const uniqueAssignedSchemes = [];
    const seenIds = new Set();
    
    for (const scheme of adminUser.assignedSchemes) {
      const schemeId = scheme._id ? scheme._id.toString() : scheme.toString();
      if (!seenIds.has(schemeId)) {
        seenIds.add(schemeId);
        uniqueAssignedSchemes.push(scheme);
      }
    }
    
    adminUser.assignedSchemes = uniqueAssignedSchemes;



    // Get all schemes to check for default status
    const allSchemes = await Scheme.find({}, '_id isDefault');
    const defaultScheme = allSchemes.find(s => s.isDefault);

    // Process each scheme in the request
    for (const { _id, isAssigned } of schemes) {
      if (!_id || typeof isAssigned !== 'boolean') {
        return res.status(400).json({ success: false, error: 'Each scheme object must have _id and isAssigned properties.' });
      }

      const scheme = allSchemes.find(s => s._id.toString() === _id.toString());

      if (!scheme) {
        // Optionally, you can skip or return an error for non-existent schemes
        console.warn(`Scheme with ID ${_id} not found. Skipping.`);
        continue;
      }

      let finalAssignmentStatus = isAssigned;

      // If it's the default scheme, it must always be assigned
      if (scheme.isDefault) {
        if (!isAssigned) {
          // If an attempt is made to unassign a default scheme, return an error
          return res.status(400).json({ success: false, error: `Default scheme '${scheme.schemeName}' cannot be unassigned.` });
        }
        finalAssignmentStatus = true; // Force default scheme to be assigned
      }

      // Update assignedSchemes array based on finalAssignmentStatus
      const schemeIndex = adminUser.assignedSchemes.findIndex(s => s._id ? s._id.toString() === _id.toString() : s.toString() === _id.toString());

      if (finalAssignmentStatus) {
        // Add scheme if not already assigned
        if (schemeIndex === -1) {
          adminUser.assignedSchemes.push(scheme._id);
        }
      } else {
        // Remove scheme if assigned
        if (schemeIndex !== -1) {
          adminUser.assignedSchemes.splice(schemeIndex, 1);
        }
      }
    }

    await adminUser.save();

    res.status(200).json({ success: true, message: 'Scheme assignment status updated successfully.', assignedSchemes: adminUser.assignedSchemes });
   } catch (error) {
     console.error('Error updating scheme assignment status:', error);
     res.status(500).json({ success: false, error: 'Failed to update scheme assignment status.' });
   }
 };
