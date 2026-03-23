import mongoose from "mongoose";

const studentDashboardSummarySchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      unique: true,
      index: true,
    },

    activeExamCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamPreparationCycle",
      default: null,
      index: true,
    },

    primaryTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    activeTeacherIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    latestLessonAt: {
      type: Date,
      default: null,
      index: true,
    },

    latestScoreEntryAt: {
      type: Date,
      default: null,
      index: true,
    },

    lessonCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    scoreEntryCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    activeCycleStatus: {
      type: String,
      default: "",
    },

    activeCycleProgressPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    activeCycleAverageScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

studentDashboardSummarySchema.index({ primaryTeacherId: 1, updatedAt: -1 });
studentDashboardSummarySchema.index({ activeTeacherIds: 1, updatedAt: -1 });

export default mongoose.models.StudentDashboardSummary ||
  mongoose.model("StudentDashboardSummary", studentDashboardSummarySchema);
