import mongoose from "mongoose";

const LessonCriterionSchema = new mongoose.Schema(
  {
    criterionId: { type: String, required: true },
    score: { type: Number, min: 0, max: 6, default: null },
    note: { type: String, default: null },
  },
  { _id: false },
);

const LessonPieceSchema = new mongoose.Schema(
  {
    pieceId: { type: String, required: true },
    percent: { type: Number, min: 0, max: 100, default: 0 },
    criteria: { type: [LessonCriterionSchema], default: [] },
  },
  { _id: false },
);

const LessonScaleItemSchema = new mongoose.Schema(
  {
    scaleId: { type: String, required: true },
    ready: { type: Boolean, required: true }, // 2-state as you want
    note: { type: String, default: null },
  },
  { _id: false },
);

const NoteBlockSchema = new mongoose.Schema(
  {
    score: { type: Number, min: 0, max: 100, default: null },
    // flexible: allow any string fields later
  },
  { _id: false, strict: false },
);

const LessonSchema = new mongoose.Schema(
  {
    lessonDate: { type: String, required: true }, // "YYYY-MM-DD"
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    share: { type: Boolean, default: false },

    pieces: { type: [LessonPieceSchema], default: [] },

    scales: {
      percent: { type: Number, min: 0, max: 100, default: 0 },
      items: { type: [LessonScaleItemSchema], default: [] },
    },

    sightReading: { type: NoteBlockSchema, default: null },
    auralTraining: { type: NoteBlockSchema, default: null },

    teacherNarrative: { type: String, default: null },
  },
  { timestamps: true },
);
LessonSchema.index(
  { teacherId: 1, studentId: 1, lessonDate: 1 },
  { unique: true },
);

export default mongoose.model("Lesson", LessonSchema);
