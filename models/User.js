import mongoose from "mongoose";

const pushLogSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: false },
    action: { type: String, required: false },
    payload: { type: mongoose.Schema.Types.Mixed, required: false },
    response: { type: mongoose.Schema.Types.Mixed, required: false },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    mobileNumber: {
      type: Number,
      required: true,
      unique: true,
    },
    mobileVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      otp: {
        type: Number,
      },
      expiry: {
        type: Date,
      },
      send_count: {
        type: Number,
      },
      send_limit_time: {
        type: Date,
      },
    },
    otpLogs: {
      type: [
        {
          otp: { type: Number },
          mobile: { type: String },
          timestamp: { type: Date },
          isVerify: { type: Boolean, default: false },
          request: { type: String, default: "" },
          response: { type: String, default: "" },
        },
      ],
      default: [],
    },
    email: {
      type: String,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    prefix: {
      type: String,
      uppercase: true,
      trim: true,
      enum: ["MR", "MS", "MRS", "Mr", "Ms", "Mrs"],
      set: (v) =>
        v ? v.toString().replace(/\./g, "").trim().toUpperCase() : v,
    },
    gender: {
      type: String,
      lowercase: true,
      trim: true,
      enum: ["male", "female", "transgender"],
      set: (v) => (v ? v.toString().trim().toLowerCase() : v),
    },
    name: {
      fullName: { type: String, trim: true, default: "" },
      firstName: { type: String, trim: true, default: "" },
      middleName: { type: String, trim: true, default: "" },
      lastName: { type: String, trim: true, default: "" },
    },
    nameAsPerAddressProof: {
      fullName: { type: String, trim: true, default: "" },
      firstName: { type: String, trim: true, default: "" },
      middleName: { type: String, trim: true, default: "" },
      lastName: { type: String, trim: true, default: "" },
    },
    isNameMatchPAN: {
      type: Boolean,
      default: false,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },

    fatherName: {
      fullName: { type: String, trim: true, default: "" },
      firstName: { type: String, trim: true, default: "" },
      middleName: { type: String, trim: true, default: "" },
      lastName: { type: String, trim: true, default: "" },
    },
    motherName: {
      fullName: { type: String, trim: true, default: "" },
      firstName: { type: String, trim: true, default: "" },
      middleName: { type: String, trim: true, default: "" },
      lastName: { type: String, trim: true, default: "" },
    },
    address: {
      addressLine1: { type: String, trim: true, default: "" },
      addressLine2: { type: String, trim: true, default: "" },
      addressLine3: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      stateCode: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "" },
      countryCode: { type: String, trim: true, default: "" },
      pincode: { type: String, trim: true, default: "" },
    },
    addressProof: {
      type: {
        type: String,
        enum: ["aadhaar", "passport", "driving_license", "voter_id"],
        default: null,
      },
      number: { type: String, default: null },
      frontImage: { type: String, default: null },
      backImage: { type: String, default: null },
      mergedPdf: { type: String, default: null },
      verificationStatus: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
      },
      uploadedAt: { type: Date },
      verifiedAt: { type: Date },
    },
    kycType: {
      type: String,
      default: null,
    },
    PAN: {
      type: String,
      default: null,
    },
    panDetails: {
      type: Object,
      default: null,
    },
    PAN_file: {
      type: String,
      default: null,
    },
    pan_source: {
      type: String,
      enum: ["digilocker", "manual", null],
      default: null,
    },
    panConfirmed: {
      type: Boolean,
      default: false,
    },
    panVerificationDetails: {
      verifiedAt: { type: Date, default: Date.now },
      status: { type: String, default: "Pending" },
      details: { type: Object, default: null },
    },
    panApiCallCount: {
      type: Number,
      default: 0,
    },
    lastPanApiCallTime: {
      type: Date,
      default: null,
    },
    max_step_completed: {
      type: Number,
    },
    lsid: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
    },
    emailOtp: {
      otp: Number,
      expiry: Date,
      send_count: Number,
      send_limit_time: Date,
    },
    emailOtpLogs: {
      type: [
        {
          otp: { type: Number },
          email: { type: String },
          timestamp: { type: Date },
          isVerify: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    digilocker_request_id: {
      type: String,
    },
    digilocker_api_call_count: {
      type: Number,
      default: 0,
    },
    digilocker_details: {
      type: Object,
      default: null,
    },
    aadhaar_file: {
      type: String,
      default: null,
    },
    aadhaar_number: {
      type: String,
    },
    aadhaar_photo: {
      type: String,
      default: null,
    },
    aadhaar_xml: {
      type: String,
      default: null,
    },
    camskra_available: {
      type: Boolean,
      default: false,
    },
    ipv_request_id: {
      type: String,
    },
    ipv_details: {
      capturedImage: {
        type: String,
      },
      matchPercentage: {
        type: String,
      },
      verificationStatus: {
        type: Boolean,
        default: false,
      },
      verifiedAt: {
        type: Date,
      },
      captured_at: {
        type: Date,
      },
    },
    liveness_verification_attempts: {
      type: Number,
      default: 0,
    },
    last_liveness_check: {
      type: Date,
    },
    liveness_status: {
      type: String,
      enum: ["pending", "verified", "failed"],
      default: "pending",
    },
    geolocation: {
      coordinates: {
        latitude: {
          type: Number,
        },
        longitude: {
          type: Number,
        },
      },
      capturedAt: {
        type: Date,
      },
      ipAddress: {
        type: String,
      },
    },
    signature: {
      signature_image: {
        type: String,
        default: null,
      },
      signature_pdf: {
        type: String,
        default: null,
      },
    },
    bank_account_details: {
      account_number: { type: String },
      bank_name: { type: String },
      branch: { type: String },
      address: { type: String },
      micr_code: { type: String },
      ifsc_code: { type: String },
      upi_handle: { type: String },
      account_holder_name: { type: String },
      account_type: { type: String, default: "Savings" },
      verification_method: { type: String, default: null },
      verification_request_id: { type: String, default: null },
      confirm_status: {
        type: String,
        enum: ["pending", "verified", "failed"],
        default: "pending",
      },
      bank_proof_file: { type: String, default: null },
      bank_proof_date: { type: Date, default: null },
      verifiedAt: { type: Date },
    },
    qualification: {
      type: String,
      enum: ["diploma", "bachelor", "master", "phd"],
    },
    maritalStatus: {
      type: String,
      enum: ["married", "unmarried"],
    },
    networth: {
      amount: { type: Number },
      date: {
        day: { type: String },
        month: { type: String },
        year: { type: String },
      },
    },
    annualIncome: {
      type: String,
      enum: [
        "below1lakh",
        "oneToFiveLakhs",
        "fiveToTenLakhs",
        "tenToTwentyFiveLakhs",
        "aboveTwentyFiveLakhs",
      ],
    },
    nominees: [
      {
        name: { type: String },
        gender: { type: String, enum: ["male", "female"] },
        relation: { type: String },
        dob: {
          day: { type: String },
          month: { type: String },
          year: { type: String },
        },
        sharePercentage: { type: String },
        guardian: {
          name: { type: String },
          relation: { type: String },
          identityType: {
            type: String,
            enum: ["PAN", "Aadhaar", "Driving License", "Passport"],
          },
          identityNumber: { type: String },
          mobile: { type: String, trim: true, default: "" },
          email: { type: String, trim: true, default: "" },
          address: {
            addressLine1: { type: String, trim: true, default: "" },
            addressLine2: { type: String, trim: true, default: "" },
            addressLine3: { type: String, trim: true, default: "" },
            city: { type: String, trim: true, default: "" },
            state: { type: String, trim: true, default: "" },
            stateCode: { type: String, trim: true, default: "" },
            country: { type: String, trim: true, default: "" },
            countryCode: { type: String, trim: true, default: "" },
            pincode: { type: String, trim: true, default: "" },
          },
        },
        identityType: {
          type: String,
          enum: ["PAN", "Aadhaar", "Driving License", "Passport"],
        }, // 1- PAN, 2- Aadhaar, 3- Driving License, 4- Passport
        identityNumber: { type: String },
        mobile: { type: String, trim: true, default: "" },
        email: { type: String, trim: true, default: "" },
        address: {
          addressLine1: { type: String, trim: true, default: "" },
          addressLine2: { type: String, trim: true, default: "" },
          addressLine3: { type: String, trim: true, default: "" },
          city: { type: String, trim: true, default: "" },
          state: { type: String, trim: true, default: "" },
          stateCode: { type: String, trim: true, default: "" },
          country: { type: String, trim: true, default: "" },
          countryCode: { type: String, trim: true, default: "" },
          pincode: { type: String, trim: true, default: "" },
        },
      },
    ],
    occupation: {
      type: String,
    },
    tradingExperience: {
      type: String,
    },
    runningAccountStatement: {
      frequency: {
        type: String,
      },
    },
    disSlipBookRequired: {
      type: Boolean,
      default: false,
      enum: [true, false],
    },
    investmentSource: {
      type: String,
      enum: ["own-funds"],
    },
    runningAccountStatement: {
      frequency: {
        type: String,
        enum: ["monthly", "quarterly"],
      },
    },
    mandatoryDeclarations: {
      type: Boolean,
      default: true,
    },
    exchange: {
      segments: {
        Cash: { type: Boolean, default: false },
        FO: { type: Boolean, default: false },
        MF: { type: Boolean, default: false },
        Commodities: { type: Boolean, default: false },
      },
      customerClassification: {
        type: String,
        enum: ["Others", "Farmer"],
        default: "Others",
      },
      financialProofs: [
        {
          type: {
            type: String,
            enum: [
              "Bank Statement",
              "ITR Copy",
              "Salary Slip",
              "Copy of Net Worth",
              "Copy of DP holding statement",
            ],
          },
          filePath: { type: String },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
    },
    contract: {
      contractId: { type: String },
      contractStatus: { type: String },
    },

    branch: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
      name: String,
    },
    relationshipManager: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
      name: String,
      employeeId: String,
    },
    authorisedPerson: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
      name: String,
      employeeId: String,
    },
    referredBy: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
      name: String,
      employeeId: String,
      role: String,
      mobile: String,
    },
    referral: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Referral",
    },
    referralCodeUsed: String,
    appliedScheme: {
      _id: { type: mongoose.Schema.Types.ObjectId, ref: "Scheme" },
      schemeName: String,
    },
    clientCode: {
      type: String,
    },
    dpId: {
      type: String,
      default: null,
    },
    ddpiConcent: {
      transfer_of_security: { type: Boolean, default: false },
      pledging: { type: Boolean, default: false },
      mutual_fund_transaction: { type: Boolean, default: false },
      tendering_shares: { type: Boolean, default: false },
    },
    digitalSignatureContract: {
      signedTime: { type: Date },
      contractName: { type: String, default: null },
      signer_name: { type: String, default: null },
      signerGender: { type: String, default: null },
      signerYearOfBirth: { type: String, default: null },
      signedByClient: {
        type: Boolean,
        default: false,
      },
      mailSent: {
        type: Boolean,
        default: false,
      },
      generatedPdf: {
        type: Boolean,
        default: false,
      },
      pdfPageCount: {
        type: Number,
        default: 0,
      },
      unSignedPdf: {
        type: String,
        default: null,
      },
      signedPdf: {
        type: String,
        default: null,
      },
    },

    annexureJContract: {
      signedTime: { type: Date },
      contractName: { type: String, default: null },
      signedByClient: {
        type: Boolean,
        default: false,
      },
      mailSent: {
        type: Boolean,
        default: false,
      },
      generatedPdf: {
        type: Boolean,
        default: false,
      },
      pdfPageCount: {
        type: Number,
        default: 0,
      },
      unSignedPdf: {
        type: String,
        default: null,
      },
      signedPdf: {
        type: String,
        default: null,
      },
      contractId: {
        type: String,
        default: null,
      },
    },
    // Track rejected steps
    rejectedSteps: {
      type: [Number],
      default: [],
    },
    // Track completed rejected steps during re-submission
    rejectedStepsDone: {
      type: [Number],
      default: [],
    },
    // Track complete rejection history across all cycles
    rejectionHistory: [
      {
        field: { type: String },
        status: { type: String, default: "rejected" },
        rejectionReason: { type: String },
        rejectedBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        rejectedAt: { type: Date },
      },
    ],
    // Track approvals for different verification steps
    approvals: {
      address: {
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        approveBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        approveAt: { type: Date },
        rejectionReason: { type: String },
        rejectedBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        rejectedAt: { type: Date },
        autoApproved: { type: Boolean, default: false },
      },
      profile: {
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        approveBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        approveAt: { type: Date },
        rejectionReason: { type: String },
        rejectedBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        rejectedAt: { type: Date },
        autoApproved: { type: Boolean, default: false },
      },
      bank: {
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        approveBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        approveAt: { type: Date },
        rejectionReason: { type: String },
        rejectedBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        rejectedAt: { type: Date },
        autoApproved: { type: Boolean, default: false },
      },
      demat: {
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        approveBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        approveAt: { type: Date },
        rejectionReason: { type: String },
        rejectedBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        rejectedAt: { type: Date },
        autoApproved: { type: Boolean, default: false },
      },
      exchange: {
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        approveBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        approveAt: { type: Date },
        rejectionReason: { type: String },
        rejectedBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        rejectedAt: { type: Date },
        autoApproved: { type: Boolean, default: false },
      },
      ipv: {
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        approveBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        approveAt: { type: Date },
        rejectionReason: { type: String },
        rejectedBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        rejectedAt: { type: Date },
        autoApproved: { type: Boolean, default: false },
      },
      signature: {
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        approveBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        approveAt: { type: Date },
        rejectionReason: { type: String },
        rejectedBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        rejectedAt: { type: Date },
        autoApproved: { type: Boolean, default: false },
      },
      digitalSign: {
        status: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        approveBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        approveAt: { type: Date },
        rejectionReason: { type: String },
        rejectedBy: {
          _id: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
          name: String,
          employeeId: String,
        },
        rejectedAt: { type: Date },
        autoApproved: { type: Boolean, default: false },
      },
    },
    userStatus: {
      type: String,
      enum: ["none", "pending", "approved", "esigned", "rejected", "completed"],
      default: "none",
    },
    pushTo: {
      bseMfStar: {
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        logs: [pushLogSchema],
        message: { type: String, default: "" },
      },
      bseStar: {
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        logs: [pushLogSchema],
        message: { type: String, default: "" },
      },
      bseStaraOf: {
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        logs: [pushLogSchema],
        message: { type: String, default: "" },
      },
      camsKraUpload: {
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        logs: [pushLogSchema],
        message: { type: String, default: "" },
      },

      ekycToCkyc: {
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        logs: [pushLogSchema],
        message: { type: String, default: "" },
      },
      photoUploadForCkyc: {
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        logs: [pushLogSchema],
        message: { type: String, default: "" },
      },
      poaUploadForCkyc: {
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        logs: [pushLogSchema],
        message: { type: String, default: "" },
      },
      signatureUploadForCkyc: {
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        logs: [pushLogSchema],
        message: { type: String, default: "" },
      },
      updateCkycStatus: {
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        logs: [pushLogSchema],
        message: { type: String, default: "" },
      },
      pushToClientMaster: {
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        logs: [pushLogSchema],
        message: { type: String, default: "" },
      },
      uploadToBSE: {
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        logs: [pushLogSchema],
        message: { type: String, default: "" },
      },
      uploadToNSE: {
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        logs: [pushLogSchema],
        message: { type: String, default: "" },
      },
      uploadToDP: {
        status: {
          type: String,
          enum: ["pending", "success", "failed"],
          default: "pending",
        },
        authToken: { type: String, default: "" }, // CDSL session token
        acknowledgmentID: { type: String, default: "" }, // Returned after upload
        liveStatus: { type: String, default: "" }, // CDSL live status ("Closed", "Initiated For processing", etc.)
        fileName: { type: String, default: "" }, // ZIP file name uploaded
        logs: [pushLogSchema],
        message: { type: String, default: "" },
      },
    },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;
