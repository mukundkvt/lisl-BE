import mongoose from "mongoose";

const bseConfigSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    memberCode: { type: String, required: true },
    password: { type: String, required: true },
    apiUrl: { type: String, required: true },
    updateHistory: [
      {
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" },
        updatedAt: { type: Date, default: Date.now },
        previousData: {
          userId: String,
          memberCode: String,
          password: String,
          apiUrl: String,
        },
      },
    ],
  },
  { timestamps: true }
);

const BseConfig = mongoose.model("BseConfig", bseConfigSchema);
export default BseConfig;
