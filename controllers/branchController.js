//For Admin

import Branch from '../models/Branch.js';
import { info, error, logDbOperation, logDbError, logPerformance, logUserAction } from '../utils/logger.js';

// Add Branch
export const addBranch = async (req, res) => {
  const { role } = req.user;
  
  // Only allow Admin users to add branches
  if (role !== 'Admin') {
    return res.status(403).json({ message: 'Only Admin users can add branches' });
  }

  const startTime = Date.now();
  try {
    const { branchName, branchCode, series, prefix } = req.body;

    info("Start: Add Branch", { branchName, branchCode });

    if (!branchName || !branchCode || !series || !prefix) {
      info("Validation failed for Add Branch", req.body);
      return res.status(400).json({ message: 'All fields are required' });
    }

    const exists = await Branch.findOne({
      $or: [
        { branchName },
        { branchCode: branchCode.toUpperCase() },
        { series },
      ],
    });

    logDbOperation("findOne", "branches", {
      query: { $or: [{ branchName }, { branchCode: branchCode.toUpperCase() }, { series }] },
      found: !!exists
    });

    if (exists) {
      return res.status(409).json({
        message: 'Branch with same code, name or series already exists',
      });
    }

    const branch = await Branch.create({
      branchName,
      branchCode: branchCode.toUpperCase(),
      series,
      prefix,
    });

    logDbOperation("create", "branches", { id: branch._id });

    const duration = Date.now() - startTime;
    logPerformance("addBranch", duration, { branchId: branch._id });

    info("End: Add Branch", { branchId: branch._id });

    res.status(201).json({ message: 'Branch created successfully', branch });
  } catch (err) {
    error("Add Branch Error", err);
    logDbError("create", "branches", err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Edit Branch
export const editBranch = async (req, res) => {
  const { role } = req.user;
  
  // Only allow Admin users to edit branches
  if (role !== 'Admin') {
    return res.status(403).json({ message: 'Only Admin users can edit branches' });
  }
  
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const { branchName, branchCode, series, prefix } = req.body;

    info("Start: Edit Branch", { branchId: id });

    const branch = await Branch.findById(id);

    logDbOperation("findById", "branches", { id, found: !!branch });

    if (!branch) {
      return res.status(404).json({ message: 'Branch not found' });
    }

    if (branchName !== undefined) branch.branchName = branchName;
    if (branchCode !== undefined) branch.branchCode = branchCode.toUpperCase();
    if (series !== undefined) branch.series = series;
    if (prefix !== undefined) branch.prefix = prefix;

    try {
      await branch.save();
      logDbOperation("save", "branches", { id: branch._id });
      const duration = Date.now() - startTime;
      logPerformance("editBranch", duration, { branchId: branch._id });
      info("End: Edit Branch", { branchId: branch._id });
      res.json({ message: 'Branch updated successfully', branch });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ message: 'Duplicate value found' });
      }
      throw err;
    }
  } catch (err) {
    error("Edit Branch Error", err);
    logDbError("update", "branches", err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get All Branches
export const getBranches = async (req, res) => {

  const startTime = Date.now();
  try {
    info("Start: Get Branches");
    const branches = await Branch.find().sort({ createdAt: -1 });
    logDbOperation("find", "branches", { count: branches.length });
    const duration = Date.now() - startTime;
    logPerformance("getBranches", duration, { count: branches.length });
    info("End: Get Branches", { count: branches.length });
    res.json(branches);
  } catch (err) {
    error("Get Branches Error", err);
    logDbError("find", "branches", err);
    res.status(500).json({ message: 'Server error' });
  }
};
