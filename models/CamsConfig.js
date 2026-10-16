import mongoose from "mongoose";

const camsConfigSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const CamsConfig = mongoose.model("CamsConfig", camsConfigSchema);
export default CamsConfig;
