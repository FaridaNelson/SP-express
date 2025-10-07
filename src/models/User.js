import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // store only the hash
    passwordHash: { type: String, select: false },
    roles: {
      type: [String],
      default: [""],
      enum: ["admin", "teacher", "student", "parent"],
    },

    // link into your domain:
    teacherId: { type: mongoose.Types.ObjectId, ref: "User" },
    studentId: { type: mongoose.Types.ObjectId, ref: "Student" },
    parentId: { type: mongoose.Types.ObjectId, ref: "Parent" },

    status: { type: String, default: "active" }, // active|locked|invited|deleted
    deletedAt: Date, // soft-delete flag
  },
  { timestamps: true }
);

// Helpers to set/verify password safely
userSchema.methods.setPassword = async function (password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};

userSchema.methods.validatePassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

export default mongoose.models.User || mongoose.model("User", userSchema);
