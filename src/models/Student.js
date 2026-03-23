import mongoose from "mongoose";
import crypto from "crypto";

const progressItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    weight: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
  },
  { _id: false },
);

const parentContactSnapshotSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, default: "" },
    lastName: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

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
      index: true,
    },
    grade: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
      index: true,
    },

    parentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    studentUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    activeExamCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamPreparationCycle",
      default: null,
      index: true,
    },

    inviteCode: {
      type: String,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(4).toString("hex").toUpperCase(),
    },

    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      index: true,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    parentContactSnapshot: {
      type: parentContactSnapshotSchema,
      default: () => ({}),
    },

    progressItems: {
      type: [progressItemSchema],
      default: [],
    },
  },
  { timestamps: true },
);

studentSchema.index({ status: 1, lastName: 1, firstName: 1 });
studentSchema.index({ parentIds: 1, status: 1 });
studentSchema.index({ studentUserId: 1 }, { sparse: true });
studentSchema.index({ instrument: 1, grade: 1 });

export default mongoose.models.Student ||
  mongoose.model("Student", studentSchema);
