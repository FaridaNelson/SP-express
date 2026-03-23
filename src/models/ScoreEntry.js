import mongoose from "mongoose";

const TEXT_NOTE_FIELD = {
  type: String,
  trim: true,
  maxlength: 1000,
  default: "",
};

const scoreEntrySchema = new mongoose.Schema(
  {
    createdByTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
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

    // the lesson/session date selected in the modal
    lessonDate: {
      type: Date,
      required: true,
      index: true,
    },

    elementId: {
      type: String,
      required: true,
      enum: [
        "scales",
        "pieceA",
        "pieceB",
        "pieceC",
        "pieceD",
        "sightReading",
        "auralTraining",
      ],
      index: true,
    },

    // optional snapshot label at the time of creation
    elementLabel: {
      type: String,
      trim: true,
      default: "",
    },

    score: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    tempoCurrent: {
      type: Number,
      min: 0,
      default: null,
    },

    tempoGoal: {
      type: Number,
      min: 0,
      default: null,
    },

    dynamics: { type: String, trim: true, maxlength: 500, default: "" },
    articulation: { type: String, trim: true, maxlength: 500, default: "" },

    sightReadingNotes: {
      pitchAccuracy: TEXT_NOTE_FIELD,
      rhythmAccuracy: TEXT_NOTE_FIELD,
      adequateTempo: TEXT_NOTE_FIELD,
      confidentPresentation: TEXT_NOTE_FIELD,
    },

    auralTrainingNotes: {
      rhythmAccuracy: TEXT_NOTE_FIELD,
      singingInPitch: TEXT_NOTE_FIELD,
      musicalMemory: TEXT_NOTE_FIELD,
      musicalPerceptiveness: TEXT_NOTE_FIELD,
    },

    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

// history queries by cycle
scoreEntrySchema.index({ examPreparationCycleId: 1, createdAt: -1 });
scoreEntrySchema.index({
  examPreparationCycleId: 1,
  elementId: 1,
  createdAt: -1,
});

// student-level history
scoreEntrySchema.index({ studentId: 1, createdAt: -1 });
scoreEntrySchema.index({ studentId: 1, elementId: 1, createdAt: -1 });
scoreEntrySchema.index({
  studentId: 1,
  examPreparationCycleId: 1,
  lessonDate: -1,
});

// authorship queries
scoreEntrySchema.index({
  createdByTeacherId: 1,
  examPreparationCycleId: 1,
  createdAt: -1,
});

// optional guard against accidental exact duplicates
scoreEntrySchema.index(
  {
    examPreparationCycleId: 1,
    elementId: 1,
    lessonDate: 1,
    createdByTeacherId: 1,
  },
  { unique: false },
);

export default mongoose.models.ScoreEntry ||
  mongoose.model("ScoreEntry", scoreEntrySchema);
