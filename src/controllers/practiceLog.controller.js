import { validateObjectId } from "../utils/validate.js";
import PracticeLog from "../models/PracticeLog.js";
import Student from "../models/Student.js";
import ExamPreparationCycle from "../models/ExamPreparationCycle.js";

export async function upsertPracticeLog(req, res, next) {
  try {
    const studentId = req.params.id;
    const userId = req.user._id;

    function normalizeDate(value) {
      if (typeof value !== "string") return null;

      const trimmed = value.trim();

      // Accept only YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

      return trimmed;
    }

    const adminBypass =
      Array.isArray(req.user?.roles) && req.user.roles.includes("admin");

    // --- Auth: verify parent is linked to student ---
    const student = await Student.findById(studentId)
      .select("_id parentIds")
      .lean();

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    if (
      !adminBypass &&
      !student.parentIds?.some((pid) => pid.toString() === userId.toString())
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const {
      examCycleId,
      weekStartDate,
      weekEndDate,
      grade,
      instrument,
      examCycleType,
      homeworkTaskList,
      totalDaysPracticed,
      tasksByDay,
    } = req.body;

    const safeStudentId = validateObjectId(studentId, "studentId");
    const safeExamCycleId = validateObjectId(examCycleId, "examCycleId");
    const safeWeekStartDate = normalizeDate(weekStartDate);

    if (!examCycleId || !weekStartDate || !weekEndDate) {
      return res.status(400).json({
        error: "examCycleId, weekStartDate, and weekEndDate are required",
      });
    }
    if (!safeWeekStartDate) {
      return res.status(400).json({ error: "Invalid weekStartDate" });
    }

    // --- Fetch cycle for server-side computations ---
    const cycle = await ExamPreparationCycle.findById(safeExamCycleId)
      .select("_id studentId createdAt examDate examType instrument examGrade")
      .lean();

    if (!cycle) {
      return res.status(404).json({ error: "Exam cycle not found" });
    }

    if (String(cycle.studentId) !== String(safeStudentId)) {
      return res
        .status(400)
        .json({ error: "Cycle does not belong to this student" });
    }

    // --- Compute weekNumber server-side ---
    const cycleStart = new Date(cycle.createdAt);
    const weekStart = new Date(weekStartDate);
    const daysBetween = Math.max(
      0,
      (weekStart - cycleStart) / (1000 * 60 * 60 * 24),
    );
    const weekNumber = Math.ceil(daysBetween / 7) || 1;

    // --- Compute daysToExam server-side ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let daysToExam = 0;
    if (cycle.examDate) {
      const examDate = new Date(cycle.examDate);
      examDate.setHours(0, 0, 0, 0);
      daysToExam = Math.max(
        0,
        Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)),
      );
    }

    // Parent dashboard currently writes all practice logs.
    // Student dashboard will write "student" once implemented.
    // Teacher role is reserved for future use when teachers can log practice outcomes.
    function getActorRole(user) {
      if (user.roles?.includes("teacher")) return "teacher";
      if (user.roles?.includes("student")) return "student";
      return "parent";
    }
    // Snapshot the role the user is acting as for audit/search context.
    const actorRole = getActorRole(req.user);

    const VALID_TASK_KEYS = [
      "pieceA",
      "pieceB",
      "pieceC",
      "pieceD",
      "scales",
      "sightReading",
      "auralTraining",
    ];

    const VALID_DAYS = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    function normalizeDailyTask(task = {}) {
      return {
        status: ["notCovered", "practiced"].includes(task.status)
          ? task.status
          : "notCovered",

        minutes:
          Number.isFinite(Number(task.minutes)) &&
          Number(task.minutes) >= 0 &&
          Number(task.minutes) <= 300
            ? Number(task.minutes)
            : 0,

        taskOutcome: ["none", "needsHelp", "inProgress"].includes(
          task.taskOutcome,
        )
          ? task.taskOutcome
          : "none",

        note:
          typeof task.note === "string" ? task.note.trim().slice(0, 500) : "",
      };
    }

    function normalizeTasksByDay(input = {}) {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        return {};
      }

      const normalized = {};

      for (const day of VALID_DAYS) {
        const dayTasks = input[day];

        if (
          !dayTasks ||
          typeof dayTasks !== "object" ||
          Array.isArray(dayTasks)
        ) {
          continue;
        }

        normalized[day] = {};

        for (const taskKey of VALID_TASK_KEYS) {
          if (dayTasks[taskKey]) {
            normalized[day][taskKey] = normalizeDailyTask(dayTasks[taskKey]);
          }
        }

        if (Object.keys(normalized[day]).length === 0) {
          delete normalized[day];
        }
      }

      return normalized;
    }

    const update = {
      lastEditedBy: userId,
      lastEditedByRole: actorRole,
      weekEndDate,
      weekNumber,
      grade: grade || String(cycle.examGrade),
      instrument: instrument || cycle.instrument,
      examCycleType: examCycleType || cycle.examType,
      daysToExam,
      homeworkTaskList,
      totalDaysPracticed: totalDaysPracticed || 0,
      tasksByDay: normalizeTasksByDay(tasksByDay),
      recordedAt: new Date(),
    };

    const practiceLog = await PracticeLog.findOneAndUpdate(
      {
        studentId: safeStudentId,
        examCycleId: safeExamCycleId,
        weekStartDate: safeWeekStartDate,
      },
      {
        $set: update,
        $setOnInsert: {
          studentId: safeStudentId,
          examCycleId: safeExamCycleId,
          weekStartDate: safeWeekStartDate,
          createdBy: userId,
          createdByRole: actorRole,
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    return res.json({ practiceLog });
  } catch (e) {
    next(e);
  }
}

export async function getPracticeLog(req, res, next) {
  try {
    const studentId = req.params.id;
    const userId = req.user._id;
    const { examCycleId, weekStartDate } = req.query;

    function normalizeDate(value) {
      if (typeof value !== "string") return null;

      const trimmed = value.trim();

      // Accept only YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;

      return trimmed;
    }

    if (!examCycleId || !weekStartDate) {
      return res.status(400).json({
        error: "examCycleId and weekStartDate are required",
      });
    }

    const safeStudentId = validateObjectId(studentId, "studentId");
    const safeExamCycleId = validateObjectId(examCycleId, "examCycleId");
    const safeWeekStartDate = normalizeDate(weekStartDate);

    if (!safeWeekStartDate) {
      return res.status(400).json({
        error: "weekStartDate must be a valid date in YYYY-MM-DD format",
      });
    }

    const adminBypass =
      Array.isArray(req.user?.roles) && req.user.roles.includes("admin");

    const student = await Student.findById(safeStudentId)
      .select("_id parentIds")
      .lean();

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    if (
      !adminBypass &&
      !student.parentIds?.some((pid) => pid.toString() === userId.toString())
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const practiceLog = await PracticeLog.findOne({
      studentId: safeStudentId,
      examCycleId: safeExamCycleId,
      weekStartDate: safeWeekStartDate,
    }).lean();

    return res.json({ practiceLog });
  } catch (e) {
    next(e);
  }
}
