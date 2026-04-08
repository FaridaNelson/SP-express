import PracticeLog from "../models/PracticeLog.js";
import Student from "../models/Student.js";
import ExamPreparationCycle from "../models/ExamPreparationCycle.js";

export async function upsertPracticeLog(req, res, next) {
  try {
    const studentId = req.params.id;
    const userId = req.user._id;
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
    } = req.body;

    if (!examCycleId || !weekStartDate || !weekEndDate) {
      return res
        .status(400)
        .json({ error: "examCycleId, weekStartDate, and weekEndDate are required" });
    }

    // --- Fetch cycle for server-side computations ---
    const cycle = await ExamPreparationCycle.findById(examCycleId)
      .select("_id studentId createdAt examDate examType instrument examGrade")
      .lean();

    if (!cycle) {
      return res.status(404).json({ error: "Exam cycle not found" });
    }

    if (cycle.studentId.toString() !== studentId) {
      return res.status(400).json({ error: "Cycle does not belong to this student" });
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

    // Determine loggedByRole
    const loggedByRole = adminBypass ? "parent" : "parent";

    const update = {
      loggedBy: userId,
      loggedByRole,
      weekEndDate,
      weekNumber,
      grade: grade || String(cycle.examGrade),
      instrument: instrument || cycle.instrument,
      examCycleType: examCycleType || cycle.examType,
      daysToExam,
      homeworkTaskList,
      totalDaysPracticed: totalDaysPracticed || 0,
      recordedAt: new Date(),
    };

    const practiceLog = await PracticeLog.findOneAndUpdate(
      { studentId, examCycleId, weekStartDate },
      { $set: update, $setOnInsert: { studentId, examCycleId, weekStartDate } },
      { upsert: true, new: true, runValidators: true },
    );

    return res.json({ practiceLog });
  } catch (e) {
    next(e);
  }
}
