import mongoose from "mongoose";

const lessonCriterionSchema = new mongoose.Schema(
  {
    criterionId: { type: String, required: true },
    score: { type: Number, min: 0, max: 6, default: null },
    note: { type: String, default: null, trim: true },
  },
  { _id: false },
);

const lessonPieceSchema = new mongoose.Schema(
  {
    pieceId: { type: String, required: true },
    status: {
      type: String,
      enum: ["not_covered", "copied", "graded"],
      default: "not_covered",
      required: true,
    },
    percent: { type: Number, min: 0, max: 100, default: 0 },
    criteria: { type: [lessonCriterionSchema], default: [] },
  },
  { _id: false },
);

const lessonScaleItemSchema = new mongoose.Schema(
  {
    scaleId: { type: String, required: true },
    ready: { type: Boolean, required: true },
    note: { type: String, default: null, trim: true },
  },
  { _id: false },
);

const noteBlockSchema = new mongoose.Schema(
  {
    score: { type: Number, min: 0, max: 100, default: null },
  },
  { _id: false, strict: false },
);

const lessonSchema = new mongoose.Schema(
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

    examPreparationCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamPreparationCycle",
      required: true,
      index: true,
    },

    instrument: {
      type: String,
      required: true,
      enum: ["Piano", "Voice", "Guitar"],
      index: true,
    },

    lessonDate: {
      type: Date,
      required: true,
      index: true,
    },

    lessonStartAt: {
      type: Date,
      required: true,
      index: true,
    },

    lessonEndAt: {
      type: Date,
      default: null,
    },

    lessonType: {
      type: String,
      enum: ["regular", "makeup", "extra"],
      default: "regular",
      index: true,
    },

    share: { type: Boolean, default: false },

    pieces: { type: [lessonPieceSchema], default: [] },

    scales: {
      percent: { type: Number, min: 0, max: 100, default: 0 },
      items: { type: [lessonScaleItemSchema], default: [] },
    },

    sightReading: { type: noteBlockSchema, default: null },
    auralTraining: { type: noteBlockSchema, default: null },

    teacherNarrative: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },

    lessonTotalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
      index: true,
    },

    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

lessonSchema.index(
  {
    createdByTeacherId: 1,
    studentId: 1,
    examPreparationCycleId: 1,
    lessonStartAt: 1,
    instrument: 1,
  },
  { unique: true },
);

lessonSchema.index({ studentId: 1, lessonDate: -1 });
lessonSchema.index({ createdByTeacherId: 1, lessonDate: -1 });
lessonSchema.index({ examPreparationCycleId: 1, lessonDate: -1 });
lessonSchema.index({ studentId: 1, instrument: 1, lessonDate: -1 });

export default mongoose.models.Lesson || mongoose.model("Lesson", lessonSchema);
