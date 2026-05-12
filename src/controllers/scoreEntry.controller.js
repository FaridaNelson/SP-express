import ScoreEntry from "../models/ScoreEntry.js";
import ExamPreparationCycle from "../models/ExamPreparationCycle.js";
import AuditLog from "../models/AuditLog.js";
import { assertTeacherCanEdit } from "../services/access.service.js";
import { recomputeStudentReadModels } from "../services/summary.service.js";
import { validateObjectId } from "../utils/validate.js";

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeString(value, fieldName) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${fieldName} cannot be empty`);
  }

  return trimmed;
}

export async function createScoreEntry(req, res, next) {
  try {
    const {
      studentId,
      examPreparationCycleId,
      lessonId,
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

    const safeStudentId = validateObjectId(studentId, "studentId");
    const safeCycleId = validateObjectId(
      examPreparationCycleId,
      "examPreparationCycleId",
    );

    const safeLessonId = lessonId
      ? validateObjectId(lessonId, "lessonId")
      : null;
    const safeInstrument = normalizeString(instrument, "instrument");
    const safeElementId = normalizeString(elementId, "elementId");
    const safeElementLabel =
      typeof elementLabel === "string" ? elementLabel.trim() : "";

    await assertTeacherCanEdit(teacherId, safeStudentId, safeInstrument);

    const parsedLessonDate = normalizeDate(lessonDate);
    if (!parsedLessonDate) {
      return res.status(400).json({ error: "Invalid lessonDate" });
    }

    const cycle = await ExamPreparationCycle.findById(safeCycleId)
      .select("_id studentId instrument archivedAt")
      .lean();

    if (!cycle || cycle.archivedAt) {
      return res.status(404).json({ error: "Cycle not found" });
    }

    if (String(cycle.studentId) !== String(safeStudentId)) {
      return res.status(400).json({ error: "Cycle mismatch" });
    }

    if (cycle.instrument !== safeInstrument) {
      return res.status(400).json({ error: "Instrument mismatch" });
    }

    const entry = await ScoreEntry.findOneAndUpdate(
      {
        createdByTeacherId: teacherId,
        studentId: safeStudentId,
        examPreparationCycleId: safeCycleId,
        lessonId: safeLessonId,
        elementId: safeElementId,
        archivedAt: null,
      },
      {
        $set: {
          instrument: safeInstrument,
          lessonDate: parsedLessonDate,
          elementLabel: safeElementLabel,
          score,
          tempoCurrent,
          tempoGoal,
          dynamics,
          articulation,
          sightReadingNotes,
          auralTrainingNotes,
        },
        $setOnInsert: {
          createdByTeacherId: teacherId,
          studentId: safeStudentId,
          examPreparationCycleId: safeCycleId,
          lessonId: safeLessonId,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    await recomputeStudentReadModels(safeStudentId);

    await AuditLog.create({
      actorUserId: teacherId,
      actorRoles: Array.isArray(req.user.roles) ? req.user.roles : [],
      action: "UPSERT_SCORE_ENTRY",
      targetType: "ScoreEntry",
      targetId: entry._id,
      studentId: safeStudentId,
      metadata: {
        examPreparationCycleId: safeCycleId,
        instrument: safeInstrument,
        lessonDate: parsedLessonDate,
        elementId: safeElementId,
        elementLabel: safeElementLabel,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    return res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
}
