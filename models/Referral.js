import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
    campaignName: {
    type: String,
    required: true
  },
  referrer: {
    _id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'AdminUser', 
      required: true 
    },
    name: String,
    employeeId: String,
    role: String
  },
  scheme: {
    _id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Scheme', 
      required: true 
    },
    schemeName: String
  },
  referralCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  referralLink: String,
  clicks: { 
    type: Number, 
    default: 0 
  },
  conversions: { 
    type: Number, 
    default: 0 
  }
}, { 
  timestamps: true 
});

const Referral = mongoose.model('Referral', referralSchema);
export default Referral;