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

const latestScoresSchema = new mongoose.Schema(
  {
    scales: { type: Number, default: null },
    pieceA: { type: Number, default: null },
    pieceB: { type: Number, default: null },
    pieceC: { type: Number, default: null },
    pieceD: { type: Number, default: null },
    sightReading: { type: Number, default: null },
    auralTraining: { type: Number, default: null },
  },
  { _id: false },
);

const progressSummarySchema = new mongoose.Schema(
  {
    requiredElements: {
      type: [String],
      default: [],
    },

    completedElements: {
      type: [String],
      default: [],
    },

    completionPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    scoreEntryCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },

    latestScores: {
      type: latestScoresSchema,
      default: () => ({}),
    },

    lastScoreEntryAt: {
      type: Date,
      default: null,
    },

    lastLessonAt: {
      type: Date,
      default: null,
    },

    updatedAt: {
      type: Date,
      default: null,
      index: true,
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

    createdByTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    instrument: {
      type: String,
      required: true,
      enum: ["Piano", "Voice", "Guitar"],
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
      required: true,
      default: "current",
      index: true,
    },

    examTaken: {
      type: Boolean,
      default: null,
    },

    examDate: {
      type: Date,
      default: null,
      index: true,
    },

    examLocation: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },

    withdrawalReason: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    closingNote: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    completion: {
      type: completionSchema,
      default: () => ({}),
    },

    progressSummary: {
      type: progressSummarySchema,
      default: () => ({}),
    },

    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

examPreparationCycleSchema.index({ studentId: 1, archivedAt: 1 });
examPreparationCycleSchema.index({
  createdByTeacherId: 1,
  studentId: 1,
  archivedAt: 1,
});
examPreparationCycleSchema.index({ studentId: 1, status: 1, archivedAt: 1 });
examPreparationCycleSchema.index({
  studentId: 1,
  createdByTeacherId: 1,
  createdAt: -1,
});

export default mongoose.models.ExamPreparationCycle ||
  mongoose.model("ExamPreparationCycle", examPreparationCycleSchema);
