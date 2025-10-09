import mongoose from "mongoose";
import crypto from "crypto";

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    instrument: { type: String, trim: true },
    grade: { type: Number },
    parent: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },
    inviteCode: {
      type: String,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(4).toString("hex").toUpperCase(),
    },
    progressItems: [
      {
        id: String,
        label: String,
        weight: Number,
        score: Number,
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Student", studentSchema);
