import ExamPreparationCycle from "../models/ExamPreparationCycle.js";
import Lesson from "../models/Lesson.js";
import ScoreEntry from "../models/ScoreEntry.js";
import Student from "../models/Student.js";
import StudentDashboardSummary from "../models/StudentDashboardSummary.js";
import TeacherStudentAccess from "../models/TeacherStudentAccess.js";

function getRequiredElements(examType) {
  if (examType === "Performance") {
    return ["pieceA", "pieceB", "pieceC", "pieceD"];
  }

  return [
    "pieceA",
    "pieceB",
    "pieceC",
    "scales",
    "sightReading",
    "auralTraining",
  ];
}

function roundToTwo(value) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 100) / 100;
}

export async function recomputeExamCycleSummary(cycleId, options = {}) {
  const { session } = options;

  const cycle = await ExamPreparationCycle.findById(cycleId).session(
    session || null,
  );
  if (!cycle) return null;

  const requiredElements = getRequiredElements(cycle.examType);

  const scoreEntries = await ScoreEntry.find({
    studentId: cycle.studentId,
    examPreparationCycleId: cycle._id,
    instrument: cycle.instrument,
    archivedAt: null,
    elementId: { $in: requiredElements },
  })
    .sort({ lessonDate: -1, createdAt: -1 })
    .session(session || null)
    .lean();

  const latestScores = {
    scales: null,
    pieceA: null,
    pieceB: null,
    pieceC: null,
    pieceD: null,
    sightReading: null,
    auralTraining: null,
  };

  const completedElements = [];
  const seen = new Set();
  let scoreSum = 0;
  let scoredCount = 0;
  let lastScoreEntryAt = null;

  for (const entry of scoreEntries) {
    if (!lastScoreEntryAt) {
      lastScoreEntryAt = entry.createdAt || null;
    }

    if (!seen.has(entry.elementId)) {
      seen.add(entry.elementId);
      completedElements.push(entry.elementId);
      latestScores[entry.elementId] =
        typeof entry.score === "number" ? entry.score : null;
    }

    if (typeof entry.score === "number") {
      scoreSum += entry.score;
      scoredCount += 1;
    }
  }

  const completionPercent =
    requiredElements.length > 0
      ? roundToTwo((completedElements.length / requiredElements.length) * 100)
      : 0;

  const averageScore =
    scoredCount > 0 ? roundToTwo(scoreSum / scoredCount) : null;

  const latestLesson = await Lesson.findOne({
    studentId: cycle.studentId,
    archivedAt: null,
  })
    .sort({ lessonDate: -1, createdAt: -1 })
    .select("lessonDate")
    .session(session || null)
    .lean();

  cycle.progressSummary = {
    requiredElements,
    completedElements,
    completionPercent: completionPercent ?? 0,
    scoreEntryCount: scoreEntries.length,
    averageScore,
    latestScores,
    lastScoreEntryAt,
    lastLessonAt: latestLesson?.lessonDate || null,
    updatedAt: new Date(),
  };

  await cycle.save({ session });

  return cycle;
}

export async function recomputeStudentDashboardSummary(
  studentId,
  options = {},
) {
  const { session } = options;

  const student = await Student.findById(studentId)
    .select("_id activeExamCycleId")
    .session(session || null);

  if (!student) return null;

  const activeAssignments = await TeacherStudentAccess.find({
    studentId: student._id,
    status: "active",
  })
    .select("teacherId role")
    .session(session || null)
    .lean();

  const primaryAssignment =
    activeAssignments.find((a) => a.role === "primary") || null;

  const activeTeacherIds = activeAssignments.map((a) => a.teacherId);

  const [latestLesson, latestScoreEntry, lessonCount, scoreEntryCount, cycle] =
    await Promise.all([
      Lesson.findOne({
        studentId: student._id,
        archivedAt: null,
      })
        .sort({ lessonDate: -1, createdAt: -1 })
        .select("lessonDate")
        .session(session || null)
        .lean(),

      ScoreEntry.findOne({
        studentId: student._id,
        archivedAt: null,
      })
        .sort({ lessonDate: -1, createdAt: -1 })
        .select("createdAt lessonDate")
        .session(session || null)
        .lean(),

      Lesson.countDocuments({
        studentId: student._id,
        archivedAt: null,
      }).session(session || null),

      ScoreEntry.countDocuments({
        studentId: student._id,
        archivedAt: null,
      }).session(session || null),

      student.activeExamCycleId
        ? ExamPreparationCycle.findById(student.activeExamCycleId)
            .select("status progressSummary")
            .session(session || null)
            .lean()
        : Promise.resolve(null),
    ]);

  const summary = await StudentDashboardSummary.findOneAndUpdate(
    { studentId: student._id },
    {
      $set: {
        activeExamCycleId: student.activeExamCycleId || null,
        primaryTeacherId: primaryAssignment?.teacherId || null,
        activeTeacherIds,
        latestLessonAt: latestLesson?.lessonDate || null,
        latestScoreEntryAt:
          latestScoreEntry?.createdAt || latestScoreEntry?.lessonDate || null,
        lessonCount,
        scoreEntryCount,
        activeCycleStatus: cycle?.status || "",
        activeCycleProgressPercent:
          cycle?.progressSummary?.completionPercent ?? 0,
        activeCycleAverageScore: cycle?.progressSummary?.averageScore ?? null,
        updatedAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      session: session || null,
    },
  );

  return summary;
}

export async function recomputeStudentReadModels(studentId, options = {}) {
  const { session } = options;

  const student = await Student.findById(studentId)
    .select("_id activeExamCycleId")
    .session(session || null);

  if (!student) {
    return {
      cycleSummary: null,
      studentSummary: null,
    };
  }

  let cycleSummary = null;

  if (student.activeExamCycleId) {
    cycleSummary = await recomputeExamCycleSummary(student.activeExamCycleId, {
      session,
    });
  }

  const studentSummary = await recomputeStudentDashboardSummary(student._id, {
    session,
  });

  return {
    cycleSummary,
    studentSummary,
  };
}
