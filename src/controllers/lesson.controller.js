import mongoose from "mongoose";
import Lesson from "../models/Lesson.js";
import ExamPreparationCycle from "../models/ExamPreparationCycle.js";
import AuditLog from "../models/AuditLog.js";
import {
  assertTeacherCanEdit,
  assertTeacherCanView,
  assertTeacherHasAnyAccess,
} from "../services/access.service.js";
import { recomputeStudentReadModels } from "../services/summary.service.js";
import { parseEnum, ALLOWED_INSTRUMENTS } from "../utils/queryParams.js";
import Student from "../models/Student.js";

function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeDateOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeScales(scales = {}) {
  return {
    percent: typeof scales?.percent === "number" ? scales.percent : 0,
    items: Array.isArray(scales?.items)
      ? scales.items.map((item) => ({
          scaleId: item.scaleId,
          ready: item.ready === true,
          note: item.note ?? null,
        }))
      : [],
  };
}

// helpers added for feature/lesson-total-score:
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function computeLessonTotalScore({
  pieces = [],
  scales = {},
  sightReading = {},
  auralTraining = {},
}) {
  const pieceMap = Object.fromEntries(
    (Array.isArray(pieces) ? pieces : []).map((piece) => [
      piece.pieceId,
      piece,
    ]),
  );

  const scoreByItemId = {
    scales: isFiniteNumber(scales?.percent) ? scales.percent : 0,
    pieceA: isFiniteNumber(pieceMap.pieceA?.percent)
      ? pieceMap.pieceA.percent
      : 0,
    pieceB: isFiniteNumber(pieceMap.pieceB?.percent)
      ? pieceMap.pieceB.percent
      : 0,
    pieceC: isFiniteNumber(pieceMap.pieceC?.percent)
      ? pieceMap.pieceC.percent
      : 0,
    sightReading: isFiniteNumber(sightReading?.score) ? sightReading.score : 0,
    auralTraining: isFiniteNumber(auralTraining?.score)
      ? auralTraining.score
      : 0,
  };

  const weightedTotal =
    clampScore(scoreByItemId.scales) * 14 +
    clampScore(scoreByItemId.pieceA) * 20 +
    clampScore(scoreByItemId.pieceB) * 20 +
    clampScore(scoreByItemId.pieceC) * 20 +
    clampScore(scoreByItemId.sightReading) * 14 +
    clampScore(scoreByItemId.auralTraining) * 12;

  return clampScore(weightedTotal / 100);
}

async function validateCycleForLesson({
  studentId,
  examPreparationCycleId,
  instrument,
}) {
  if (!examPreparationCycleId) {
    throw createHttpError(400, "examPreparationCycleId is required");
  }

  const cycle = await ExamPreparationCycle.findById(examPreparationCycleId)
    .select("_id studentId instrument status archivedAt")
    .lean();

  if (!cycle) {
    throw createHttpError(404, "Exam cycle not found");
  }

  if (String(cycle.studentId) !== String(studentId)) {
    throw createHttpError(400, "Exam cycle does not belong to this student");
  }

  if (cycle.instrument !== instrument) {
    throw createHttpError(400, "Instrument does not match exam cycle");
  }

  if (cycle.archivedAt) {
    throw createHttpError(400, "Cannot attach lesson to an archived cycle");
  }

  return cycle;
}
export async function updateLesson(req, res, next) {
  try {
    const { lessonId } = req.params;
    const teacherId = req.user._id;

    const lesson = await Lesson.findOne({
      _id: lessonId,
      createdByTeacherId: teacherId,
      archivedAt: null,
    });

    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    const {
      lessonDate,
      lessonStartAt,
      lessonEndAt = null,
      lessonType = lesson.lessonType,
      share = lesson.share,
      pieces = lesson.pieces,
      scales = lesson.scales,
      sightReading = lesson.sightReading,
      auralTraining = lesson.auralTraining,
      teacherNarrative = lesson.teacherNarrative,
    } = req.body || {};

    const parsedLessonDate = normalizeDateOnly(lessonDate);
    if (!parsedLessonDate) {
      return res.status(400).json({ error: "Invalid lessonDate" });
    }

    const parsedLessonStartAt = normalizeDateTime(lessonStartAt);
    if (!parsedLessonStartAt) {
      return res.status(400).json({ error: "Invalid lessonStartAt" });
    }

    const parsedLessonEndAt = lessonEndAt
      ? normalizeDateTime(lessonEndAt)
      : null;

    if (lessonEndAt && !parsedLessonEndAt) {
      return res.status(400).json({ error: "Invalid lessonEndAt" });
    }

    if (
      parsedLessonEndAt &&
      parsedLessonEndAt.getTime() <= parsedLessonStartAt.getTime()
    ) {
      return res.status(400).json({
        error: "lessonEndAt must be later than lessonStartAt",
      });
    }

    await assertTeacherCanEdit(teacherId, lesson.studentId, lesson.instrument);

    const normalizedScales = normalizeScales(scales);
    const normalizedPieces = Array.isArray(pieces) ? pieces : [];

    lesson.lessonDate = parsedLessonDate;
    lesson.lessonStartAt = parsedLessonStartAt;
    lesson.lessonEndAt = parsedLessonEndAt;
    lesson.lessonType = lessonType;
    lesson.share = !!share;
    lesson.pieces = normalizedPieces;
    lesson.scales = normalizedScales;
    lesson.sightReading = sightReading;
    lesson.auralTraining = auralTraining;
    lesson.teacherNarrative = teacherNarrative;
    lesson.lessonTotalScore = computeLessonTotalScore({
      pieces: normalizedPieces,
      scales: normalizedScales,
      sightReading,
      auralTraining,
    });

    await lesson.save();
    await recomputeStudentReadModels(lesson.studentId);

    await AuditLog.create({
      actorUserId: teacherId,
      actorRoles: Array.isArray(req.user.roles) ? req.user.roles : [],
      action: "UPDATE_LESSON",
      targetType: "Lesson",
      targetId: lesson._id,
      studentId: lesson.studentId,
      metadata: {
        examPreparationCycleId: lesson.examPreparationCycleId,
        instrument: lesson.instrument,
        lessonDate: parsedLessonDate,
        lessonStartAt: parsedLessonStartAt,
        lessonEndAt: parsedLessonEndAt,
        lessonType,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    return res.json({ lesson });
  } catch (err) {
    next(err);
  }
}

export async function upsertLesson(req, res, next) {
  try {
    const teacherId = req.user._id;
    const {
      studentId,
      examPreparationCycleId,
      instrument,
      lessonDate,
      lessonStartAt,
      lessonEndAt = null,
      lessonType = "regular",
      share = false,
      pieces = [],
      scales = { percent: 0, items: [] },
      sightReading = null,
      auralTraining = null,
      teacherNarrative = null,
    } = req.body || {};

    if (
      !studentId ||
      !examPreparationCycleId ||
      !instrument ||
      !lessonDate ||
      !lessonStartAt
    ) {
      return res.status(400).json({
        error:
          "studentId, examPreparationCycleId, instrument, lessonDate, and lessonStartAt are required",
      });
    }

    await assertTeacherCanEdit(teacherId, studentId, instrument);

    const parsedLessonDate = normalizeDateOnly(lessonDate);
    if (!parsedLessonDate) {
      return res.status(400).json({ error: "Invalid lessonDate" });
    }

    const parsedLessonStartAt = normalizeDateTime(lessonStartAt);
    if (!parsedLessonStartAt) {
      return res.status(400).json({ error: "Invalid lessonStartAt" });
    }

    const parsedLessonEndAt = lessonEndAt
      ? normalizeDateTime(lessonEndAt)
      : null;

    if (lessonEndAt && !parsedLessonEndAt) {
      return res.status(400).json({ error: "Invalid lessonEndAt" });
    }

    if (
      parsedLessonEndAt &&
      parsedLessonEndAt.getTime() <= parsedLessonStartAt.getTime()
    ) {
      return res.status(400).json({
        error: "lessonEndAt must be later than lessonStartAt",
      });
    }

    await validateCycleForLesson({
      studentId,
      examPreparationCycleId,
      instrument,
    });

    const normalizedScales = normalizeScales(scales);

    const normalizedPieces = Array.isArray(pieces) ? pieces : [];

    const computedLessonTotalScore = computeLessonTotalScore({
      pieces: normalizedPieces,
      scales: normalizedScales,
      sightReading,
      auralTraining,
    });

    const lesson = await Lesson.findOneAndUpdate(
      {
        createdByTeacherId: teacherId,
        studentId,
        examPreparationCycleId,
        instrument,
        lessonStartAt: parsedLessonStartAt,
      },
      {
        $set: {
          createdByTeacherId: teacherId,
          studentId,
          examPreparationCycleId,
          instrument,
          lessonDate: parsedLessonDate,
          lessonStartAt: parsedLessonStartAt,
          lessonEndAt: parsedLessonEndAt,
          lessonType,
          share: !!share,
          pieces: normalizedPieces,
          scales: normalizedScales,
          sightReading,
          auralTraining,
          teacherNarrative,
          lessonTotalScore: computedLessonTotalScore,
          archivedAt: null,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    await recomputeStudentReadModels(studentId);

    await AuditLog.create({
      actorUserId: teacherId,
      actorRoles: Array.isArray(req.user.roles) ? req.user.roles : [],
      action: "UPSERT_LESSON",
      targetType: "Lesson",
      targetId: lesson._id,
      studentId,
      metadata: {
        examPreparationCycleId,
        instrument,
        lessonDate: parsedLessonDate,
        lessonStartAt: parsedLessonStartAt,
        lessonEndAt: parsedLessonEndAt,
        lessonType,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    return res.status(200).json({ lesson });
  } catch (err) {
    next(err);
  }
}

export async function getLessonById(req, res, next) {
  try {
    const { lessonId } = req.params;

    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson || lesson.archivedAt) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    try {
      await assertTeacherCanView(
        req.user._id,
        lesson.studentId,
        lesson.instrument,
      );
    } catch {
      return res.status(404).json({ error: "Lesson not found" });
    }

    return res.json({ lesson });
  } catch (err) {
    next(err);
  }
}

export async function listLessonsForStudent(req, res, next) {
  try {
    const { studentId } = req.params;
    const { examPreparationCycleId, cycleId, instrument } = req.query;

    const effectiveCycleId = cycleId || examPreparationCycleId;

    if (
      effectiveCycleId &&
      !mongoose.Types.ObjectId.isValid(effectiveCycleId)
    ) {
      return res.status(400).json({ error: "Invalid cycleId" });
    }

    // Parent ownership guard — parents may only view their own children's lessons
    if (req.user.role === "parent") {
      const student = await Student.findById(studentId);
      if (!student)
        return res.status(404).json({ message: "Student not found" });
      const isLinked = student.parentIds?.some(
        (id) => id.toString() === req.user._id.toString(),
      );
      if (!isLinked) return res.status(403).json({ message: "Access denied" });
    }

    if (req.user.role !== "parent") {
      if (instrument) {
        parseEnum(instrument, ALLOWED_INSTRUMENTS, "instrument");
        await assertTeacherCanView(req.user._id, studentId, instrument);
      } else {
        await assertTeacherHasAnyAccess(req.user._id, studentId);
      }
    }

    const query = {
      studentId,
      archivedAt: null,
    };

    if (effectiveCycleId) {
      query.examPreparationCycleId = effectiveCycleId;
    }

    if (instrument) {
      query.instrument = instrument;
    }

    const lessons = await Lesson.find(query)
      .sort({ lessonDate: -1, lessonStartAt: -1, createdAt: -1 })
      .lean();

    return res.json({ lessons });
  } catch (err) {
    next(err);
  }
}

export async function getLatestLessonForStudent(req, res, next) {
  try {
    const { studentId } = req.params;
    const { examPreparationCycleId, instrument } = req.query;

    if (instrument) {
      parseEnum(instrument, ALLOWED_INSTRUMENTS, "instrument");
      await assertTeacherCanView(req.user._id, studentId, instrument);
    } else {
      await assertTeacherHasAnyAccess(req.user._id, studentId);
    }

    const query = {
      studentId,
      archivedAt: null,
    };

    if (examPreparationCycleId) {
      query.examPreparationCycleId = examPreparationCycleId;
    }

    if (instrument) {
      query.instrument = instrument;
    }

    const lesson = await Lesson.findOne(query)
      .sort({ lessonDate: -1, lessonStartAt: -1, createdAt: -1 })
      .lean();

    return res.json({ lesson: lesson || null });
  } catch (err) {
    next(err);
  }
}

export async function archiveLesson(req, res, next) {
  try {
    const teacherId = req.user._id;
    const { lessonId } = req.params;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson || lesson.archivedAt) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    await assertTeacherCanEdit(teacherId, lesson.studentId, lesson.instrument);

    lesson.archivedAt = new Date();
    await lesson.save();

    await recomputeStudentReadModels(lesson.studentId);

    await AuditLog.create({
      actorUserId: teacherId,
      actorRoles: Array.isArray(req.user.roles) ? req.user.roles : [],
      action: "ARCHIVE_LESSON",
      targetType: "Lesson",
      targetId: lesson._id,
      studentId: lesson.studentId,
      metadata: {
        examPreparationCycleId: lesson.examPreparationCycleId,
        instrument: lesson.instrument,
        lessonDate: lesson.lessonDate,
        lessonStartAt: lesson.lessonStartAt,
        lessonEndAt: lesson.lessonEndAt,
        lessonType: lesson.lessonType,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
