import mongoose from "mongoose";

/**
 * TODO v2:
 *
 * - resetSchema
 * - lastPlayed
 * - teacher analytics cache
 * - AI embeddings
 * - archive support
 * - achievement tracking
 * - app registry support
 */

const sessionSchema = new mongoose.Schema(
  {
    score: Number,
    correct: Number,
    incorrect: Number,
    duration: Number,

    mode: {
      type: String,
      enum: ["practice", "timed"],
    },

    timerMinutes: Number,

    endedBy: {
      type: String,
      enum: ["student", "timer", "pagehide"],
    },

    completedAt: Date,
  },
  { _id: false },
);

const cumulativeStatSchema = new mongoose.Schema(
  {
    seen: {
      type: Number,
      default: 0,
    },
    wrong: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

const gameProgressSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    appId: {
      type: String,
      required: true,
      enum: ["note-detective"],
    },
    appType: {
      type: String,
      enum: ["game", "quiz", "mockExam", "audio", "video", "aiExercise"],
      default: "game",
    },
    cycleContext: {
      cycleType: {
        type: String,
        enum: ["exam", "custom", "none"],
        default: "exam",
      },

      examCycleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ExamCycle",
      },

      learningCycleId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
      },
    },

    moduleId: String,

    unitId: String,

    cumulativeStats: {
      type: Map,
      of: cumulativeStatSchema,
      default: {},
    },

    sessions: {
      type: [sessionSchema],
      default: [],
    },

    resetHistory: {
      type: Array,
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

gameProgressSchema.index({ studentId: 1, appId: 1 }, { unique: true });

gameProgressSchema.index({ "cycleContext.examCycleId": 1 });

gameProgressSchema.index({ "cycleContext.learningCycleId": 1 });

export default mongoose.model("GameProgress", gameProgressSchema);
