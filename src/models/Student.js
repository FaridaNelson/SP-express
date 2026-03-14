import mongoose from "mongoose";
import crypto from "crypto";

const studentSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 40,
    },
    lastName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 40,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 90,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    instrument: {
      type: String,
      required: true,
      enum: ["Piano", "Voice", "Guitar"],
    },
    grade: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },

    parentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    parent: {
      firstName: {
        type: String,
        trim: true,
        default: "",
      },
      lastName: {
        type: String,
        trim: true,
        default: "",
      },
      name: {
        type: String,
        trim: true,
        default: "",
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
      },
      phone: {
        type: String,
        trim: true,
        default: "",
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

studentSchema.index({ teacherId: 1, lastName: 1, firstName: 1 });
studentSchema.index({ teacherId: 1, createdAt: 1 });
studentSchema.index({ teacherId: 1, activeExamCycleId: 1 });

export default mongoose.models.Student ||
  mongoose.model("Student", studentSchema);
