import mongoose from "mongoose";

const cdslConfigSchema = new mongoose.Schema(
  {
    dpId: {
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
    aesKey: {
      type: String,
      required: true,
    },
    referer: {
      type: String,
      required: true,
    },
    authUrl: {
      type: String,
      required: true,
    },
    uploadUrl: {
      type: String,
      required: true,
    },
    statusUrl: {
      type: String,
      required: true,
    },
    downloadUrl: {
      type: String,
      required: true,
    },
    modifyUrl: {
      type: String,
      required: true,
    },
    lastBatchNumber: {
      type: Number,
      default: 32000,
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
          dpId: String,
          userId: String,
          password: String,
          aesKey: String,
          referer: String,
          authUrl: String,
          uploadUrl: String,
          statusUrl: String,
          downloadUrl: String,
          modifyUrl: String,
        },
      },
    ],
  },
  { timestamps: true }
);

const CdslConfig = mongoose.model("CdslConfig", cdslConfigSchema);
export default CdslConfig;
