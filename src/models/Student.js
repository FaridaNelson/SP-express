import mongoose from "mongoose";
import crypto from "crypto";

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    instrument: {
      type: String,
      required: true,
      enum: ["Piano", "Voice", "Guitar"],
    },
    grade: { type: Number, required: true, min: 1, max: 8 },
    parentIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      validate: {
        validator: function (arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: "At least one parent is required",
      },
    },
    studentUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },
    activeExamCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamPreparationCycle",
      default: null,
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
  { timestamps: true },
);

export default mongoose.model("Student", studentSchema);
