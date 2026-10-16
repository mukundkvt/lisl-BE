import mongoose from 'mongoose';

const adminUserSchema = new mongoose.Schema(
  {
    loginName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      // required: true,
      // unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ['Scrutiny Officer', 'Supervisor', 'Admin', 'Relationship Manager', 'Authorised Person', 'Branch'],
      required: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null, // only needed for RMs
    },
    reportingTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null, // AP → RM
    },
    mobile: {
      type: String,
      required: true,
    },
    
  teamMembers: [{  // People reporting to this user
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    role: String
  }],
  
  // Referral
  assignedSchemes: [{
    _id: mongoose.Schema.Types.ObjectId,
    schemeName: String
  }],
    password: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
    lastLoginTime: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('AdminUser', adminUserSchema);
