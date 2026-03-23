import ScoreEntry from "../models/ScoreEntry.js";
import ExamPreparationCycle from "../models/ExamPreparationCycle.js";
import AuditLog from "../models/AuditLog.js";
import { assertTeacherCanEdit } from "../services/access.service.js";
import { recomputeStudentReadModels } from "../services/summary.service.js";

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createScoreEntry(req, res, next) {
  try {
    const {
      studentId,
      examPreparationCycleId,
      instrument,
      lessonDate,
      elementId,
      elementLabel,
      score,
      tempoCurrent,
      tempoGoal,
      dynamics,
      articulation,
      sightReadingNotes,
      auralTrainingNotes,
    } = req.body || {};

    const teacherId = req.user._id;

    if (
      !studentId ||
      !examPreparationCycleId ||
      !instrument ||
      !lessonDate ||
      !elementId
    ) {
      return res.status(400).json({
        error:
          "studentId, examPreparationCycleId, instrument, lessonDate, and elementId are required",
      });
    }

    await assertTeacherCanEdit(teacherId, studentId, instrument);

    const parsedLessonDate = normalizeDate(lessonDate);
    if (!parsedLessonDate) {
      return res.status(400).json({ error: "Invalid lessonDate" });
    }

    const cycle = await ExamPreparationCycle.findById(examPreparationCycleId)
      .select("_id studentId instrument archivedAt")
      .lean();

    if (!cycle || cycle.archivedAt) {
      return res.status(404).json({ error: "Cycle not found" });
    }

    if (String(cycle.studentId) !== String(studentId)) {
      return res.status(400).json({ error: "Cycle mismatch" });
    }

    if (cycle.instrument !== instrument) {
      return res.status(400).json({ error: "Instrument mismatch" });
    }

    const entry = await ScoreEntry.create({
      createdByTeacherId: teacherId,
      studentId,
      examPreparationCycleId,
      instrument,
      lessonDate: parsedLessonDate,
      elementId,
      elementLabel,
      score,
      tempoCurrent,
      tempoGoal,
      dynamics,
      articulation,
      sightReadingNotes,
      auralTrainingNotes,
    });

    await recomputeStudentReadModels(studentId);

    await AuditLog.create({
      actorUserId: teacherId,
      actorRoles: Array.isArray(req.user.roles) ? req.user.roles : [],
      action: "CREATE_SCORE_ENTRY",
      targetType: "ScoreEntry",
      targetId: entry._id,
      studentId,
      metadata: {
        examPreparationCycleId,
        instrument,
        lessonDate: parsedLessonDate,
        elementId,
        elementLabel: elementLabel || "",
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    return res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
}
