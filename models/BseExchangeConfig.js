import mongoose from "mongoose";

const bseExchangeConfigSchema = new mongoose.Schema(
  {
    memberId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    uccVersion: {
      type: String,
      default: "CLIENTDETAILS_V5",
    },
    uploadApiUrl: {
      type: String,
      required: true,
      default: "https://ucc.bseindia.com/UCC_REST_API_SERVICE/UCCService.svc/AddUCCData_V5",
    },
    resetPasswordUrl: {
      type: String,
      default: "https://ucc.bseindia.com/UCC_REST_API_SERVICE/UCCService.svc/ResetPassword",
    },
    resetPanStatusUrl: {
      type: String,
      default: "https://ucc.bseindia.com/UCC_REST_API_SERVICE/UCCService.svc/PANStatus",
    },
    publicKey: {
      type: String,
      default: "",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
    },
    updateHistory: [
      {
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
        updatedAt: { type: Date, default: Date.now },
        previousData: {
          memberId: String,
          userId: String,
          password: String,
          uccVersion: String,
          uploadApiUrl: String,
          resetPasswordUrl: String,
          resetPanStatusUrl: String,
          publicKey: String,
        },
      },
    ],
  },
  { timestamps: true }
);

const BseExchangeConfig = mongoose.model("BseExchangeConfig", bseExchangeConfigSchema);
export default BseExchangeConfig;
