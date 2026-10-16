import mongoose from "mongoose";

const deletedUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  PAN: {
    type: String,
    required: true,
    uppercase: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
  },
  mobileNumber: {
    type: Number,
    required: true,
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AdminUser",
    required: true,
  },
  reason: {
    type: String,
    required: true,
    trim: true,
  },
  deletedAt: {
    type: Date,
    default: Date.now,
  },
});

const DeletedUser = mongoose.model("DeletedUser", deletedUserSchema);
export default DeletedUser;