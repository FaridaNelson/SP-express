import mongoose from "mongoose";

const scoreEntrySchema = new mongoose.Schema(
  {
    teacherId: {
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

    // what teacher selected in the modal
    lessonDate: { type: Date, required: true }, // from the date input

    elementId: {
      type: String,
      required: true,
      enum: [
        "scales",
        "pieceA",
        "pieceB",
        "pieceC",
        "sightReading",
        "auralTraining",
      ],
      index: true,
    },
    elementLabel: { type: String }, // optional snapshot

    score: { type: Number, min: 0, max: 100 },
    tempoCurrent: { type: Number, min: 0 },
    tempoGoal: { type: Number, min: 0 },
    dynamics: { type: String, trim: true, maxlength: 1000 },
    articulation: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true }, // createdAt is the “time of creation”
);

// fast history queries
scoreEntrySchema.index({ studentId: 1, createdAt: -1 });
scoreEntrySchema.index({ studentId: 1, elementId: 1, createdAt: -1 });

export default mongoose.model("ScoreEntry", scoreEntrySchema);
