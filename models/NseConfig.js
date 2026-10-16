import mongoose from "mongoose";

const nseConfigSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
      select: false, // security
    },

    apiName: {
      type: String,
      default: "uci_clientupload",
    },

    authUrl: {
      type: String,
      required: true,
    },

    clientUploadUrl: {
      type: String,
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
    },
  },
  { timestamps: true }
);

const NseConfig = mongoose.model("NseConfig", nseConfigSchema);
export default NseConfig;
