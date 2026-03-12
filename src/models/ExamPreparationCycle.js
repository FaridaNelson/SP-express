import mongoose from "mongoose";

const sectionResultSchema = new mongoose.Schema(
  {
    score: { type: Number, default: null },
    comments: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const completionSchema = new mongoose.Schema(
  {
    examTakenAt: { type: Date, default: null },

    awardType: {
      type: String,
      enum: ["", "fail", "pass", "merit", "distinction"],
      default: "",
    },

    totalScore: { type: Number, default: null },

    overallJudgesComments: {
      type: String,
      default: "",
      trim: true,
    },

    sectionResults: {
      pieceA: { type: sectionResultSchema, default: () => ({}) },
      pieceB: { type: sectionResultSchema, default: () => ({}) },
      pieceC: { type: sectionResultSchema, default: () => ({}) },
      pieceD: { type: sectionResultSchema, default: () => ({}) },
      sightReading: { type: sectionResultSchema, default: () => ({}) },
      auralTraining: { type: sectionResultSchema, default: () => ({}) },
    },
  },
  { _id: false },
);

const examPreparationCycleSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    examType: {
      type: String,
      enum: ["Practical", "Performance"],
      required: true,
    },

    examGrade: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },

    status: {
      type: String,
      enum: ["current", "registered", "completed", "withdrawn"],
      default: "current",
      required: true,
    },

    examTaken: {
      type: Boolean,
      default: null,
    },

    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },

    examDate: {
      type: Date,
      default: null,
    },

    examLocation: {
      type: String,
      default: "",
      trim: true,
    },

    withdrawalReason: {
      type: String,
      default: "",
      trim: true,
    },

    closingNote: {
      type: String,
      default: "",
      trim: true,
    },

    completion: {
      type: completionSchema,
      default: () => ({}),
    },
  },
  { timestamps: true },
);

examPreparationCycleSchema.index({ studentId: 1, archivedAt: 1 });
examPreparationCycleSchema.index({ teacherId: 1, studentId: 1, archivedAt: 1 });

export default mongoose.models.ExamPreparationCycle ||
  mongoose.model("ExamPreparationCycle", examPreparationCycleSchema);
