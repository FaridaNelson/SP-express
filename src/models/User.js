import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    name: { type: String, required: true, trim: true, maxlength: 90 },
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
      default: [],
      enum: ["admin", "teacher", "student", "parent"],
      index: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 30,
    },

    instrument: {
      type: String,
      enum: ["", "Piano", "Voice", "Guitar"],
      default: "",
      trim: true,
    },
    studioName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    instrumentsTaught: {
      type: [String],
      default: [],
      enum: ["Piano", "Voice", "Guitar"],
    },
    yearsTeaching: {
      type: String,
      default: "",
      enum: ["", "0-2", "3-5", "6-10", "10+"],
    },

    status: {
      type: String,
      enum: ["active", "locked", "invited", "deleted"],
      default: "active",
      index: true,
    },
    deletedAt: { type: Date, default: null },

    passwordResetToken: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },
  },
  { timestamps: true },
);

// Helpers to set/verify password safely
userSchema.methods.setPassword = async function (password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};

userSchema.methods.validatePassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

export default mongoose.models.User || mongoose.model("User", userSchema);
