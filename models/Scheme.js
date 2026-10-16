import mongoose from 'mongoose';

const schemeSchema = new mongoose.Schema({
  // Scheme Identification
  schemeId: {
    type: Number,
    unique: true
  },
  schemeName: {
    type: String,
    required: true,
    trim: true
  },

  // Trading Brokerage
  cMSegmentTradingBrokerage: { type: Number, default: 0 },
  fOSegmentTradingBrokerage: { type: Number, default: 0 },
  currencyTradingBrokerage: { type: Number, default: 0 },
  mCXNCDEXTradingBrokerage: { type: Number, default: 0 },

  // Delivery Brokerage
  cMSegmentDeliveryBrokerage: { type: Number, default: 0 },
  fOSegmentDeliveryBrokerage: { type: Number, default: 0 },
  currencyDeliveryBrokerage: { type: Number, default: 0 },
  mCXNCDEXDeliveryBrokerage: { type: Number, default: 0 },

  // Minimum Brokerage (in paisa)
  cMSegmentMinimumBrokerageInPaisa: { type: Number, default: 0 },
  fOSegmentMinimumBrokerageInPaisa: { type: Number, default: 0 },
  currencyMinimumBrokerageInPaisa: { type: Number, default: 0 },
  mCXNCDEXMinimumBrokerageInPaisa: { type: Number, default: 0 },

  // Option Brokerage (in Rs)
  fOSegmentOptionBrokerageInRs: { type: Number, default: 0 },
  currencyOptionBrokerageInRs: { type: Number, default: 0 },
  mCXNCDEXOptionBrokerageInRs: { type: Number, default: 0 },

  // Share PRO Fields
  cBrkgBasketNSE: { type: String },
  cBrkgBasketBSE: { type: String },
  cBrkgBasketFO: { type: String },
  nDelCMBrkg: { type: Number, default: 0 },
  nDelCMBrkgMin: { type: Number, default: 0 },
  nSqCMBrkg: { type: Number, default: 0 },
  nSqCMBrkgMin: { type: Number, default: 0 },
  nFutBrkg: { type: Number, default: 0 },
  nFutBrkgMin: { type: Number, default: 0 },

  // System Fields
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'AdminUser' 
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'AdminUser' 
  }
}, { 
  timestamps: true 
});

const Scheme = mongoose.model('Scheme', schemeSchema);
export default Scheme;