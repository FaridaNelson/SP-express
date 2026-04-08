import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    daysPracticed: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastPracticedDate: { type: String, default: null }, // "YYYY-MM-DD"
  },
  { _id: false },
);

const practiceLogSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    examCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamPreparationCycle",
      required: true,
    },
    loggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    loggedByRole: {
      type: String,
      enum: ["parent", "student", "teacher"],
      required: true,
    },

    weekStartDate: { type: String, required: true }, // "YYYY-MM-DD" always Sunday
    weekEndDate: { type: String, required: true }, // "YYYY-MM-DD" always Saturday
    weekNumber: { type: Number, required: true }, // weeks since cycle start

    grade: { type: String, required: true },
    instrument: { type: String, required: true },
    examCycleType: {
      type: String,
      enum: ["Practical", "Performance"],
      required: true,
    },
    daysToExam: { type: Number, required: true },

    homeworkTaskList: {
      pieceA: { type: taskSchema },
      pieceB: { type: taskSchema },
      pieceC: { type: taskSchema },
      pieceD: { type: taskSchema },
      scales: { type: taskSchema },
      sightReading: { type: taskSchema },
      auralTraining: { type: taskSchema },
    },

    totalDaysPracticed: { type: Number, default: 0 },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// One log per student per week per cycle
practiceLogSchema.index(
  { studentId: 1, examCycleId: 1, weekStartDate: 1 },
  { unique: true },
);

export default mongoose.model("PracticeLog", practiceLogSchema);
