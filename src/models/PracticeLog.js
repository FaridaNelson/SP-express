import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    daysPracticed: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastPracticedDate: { type: String, default: null }, // "YYYY-MM-DD"
    totalMinutes: { type: Number, default: 0 },
  },
  { _id: false },
);

const dailyTaskSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["notCovered", "practiced"],
      default: "notCovered",
    },

    minutes: {
      type: Number,
      default: 0,
      min: 0,
      max: 300,
    },

    taskOutcome: {
      type: String,
      enum: ["none", "needsHelp", "inProgress"],
      default: "none",
    },

    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    createdByRole: {
      type: String,
      enum: ["parent", "student", "teacher"],
      required: true,
    },

    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lastEditedByRole: {
      type: String,
      enum: ["parent", "student", "teacher"],
      default: null,
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
    tasksByDay: {
      type: Map,
      of: new mongoose.Schema(
        {
          pieceA: { type: dailyTaskSchema },
          pieceB: { type: dailyTaskSchema },
          pieceC: { type: dailyTaskSchema },
          pieceD: { type: dailyTaskSchema },
          scales: { type: dailyTaskSchema },
          sightReading: { type: dailyTaskSchema },
          auralTraining: { type: dailyTaskSchema },
        },
        { _id: false },
      ),
      default: {},
    },
  },
  { timestamps: true },
);

// One log per student per week per cycle
practiceLogSchema.index(
  { studentId: 1, examCycleId: 1, weekStartDate: 1 },
  { unique: true },
);

export default mongoose.model("PracticeLog", practiceLogSchema);
