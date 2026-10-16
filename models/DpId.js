import mongoose from "mongoose";

const dpIdSchema = new mongoose.Schema(
  {
    dpId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    is_used: {
      type: Boolean,
      default: false,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("DpId", dpIdSchema);
