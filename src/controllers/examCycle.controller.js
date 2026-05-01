import ExamPreparationCycle from "../models/ExamPreparationCycle.js";
import Student from "../models/Student.js";
import AuditLog from "../models/AuditLog.js";
import { validateObjectId } from "../utils/validate.js";
import {
  assertTeacherCanEdit,
  assertTeacherCanView,
  assertTeacherHasAnyAccess,
} from "../services/access.service.js";
import {
  recomputeExamCycleSummary,
  recomputeStudentReadModels,
} from "../services/summary.service.js";
import {
  parseBoolean,
  parseEnum,
  ALLOWED_INSTRUMENTS,
} from "../utils/queryParams.js";

function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeTrimmedString(value) {
  return String(value || "").trim();
}

async function getStudentOrThrow(studentId) {
  const student = await Student.findById(studentId)
    .select("_id instrument activeExamCycleId status archivedAt")
    .lean();

  if (!student || student.archivedAt || student.status === "archived") {
    throw createHttpError(404, "Student not found");
  }

  return student;
}

async function getCycleOrThrow(cycleId) {
  const cycle = await ExamPreparationCycle.findById(cycleId);

  if (!cycle || cycle.archivedAt) {
    throw createHttpError(404, "Exam cycle not found");
  }

  return cycle;
}

async function ensureCycleBelongsToStudent(cycle, studentId) {
  if (String(cycle.studentId) !== String(studentId)) {
    throw createHttpError(400, "Exam cycle does not belong to this student");
  }
}

async function ensureInstrumentProvided(instrument) {
  if (!instrument) {
    throw createHttpError(400, "instrument is required");
  }
}

function getRequiredElementsForExamType(examType) {
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

export async function createExamCycle(req, res, next) {
  try {
    const teacherId = req.user._id;
    const {
      studentId,
      instrument,
      examType,
      examGrade,
      status = "current",
      examDate = null,
      examLocation = "",
      withdrawalReason = "",
      closingNote = "",
      examTaken = null,
      pieces = [],
    } = req.body || {};

    if (!studentId || !instrument || !examType || !examGrade) {
      return res.status(400).json({
        error: "studentId, instrument, examType, and examGrade are required",
      });
    }

    await assertTeacherCanEdit(teacherId, studentId, instrument);

    await getStudentOrThrow(studentId);
    await ensureInstrumentProvided(instrument);

    const parsedExamDate = examDate ? normalizeDate(examDate) : null;
    if (examDate && !parsedExamDate) {
      return res.status(400).json({ error: "Invalid examDate" });
    }

    // 🔥 NEW: initialize requiredElements
    const requiredElements = getRequiredElementsForExamType(examType);

    // Sanitize pieces array
    const sanitizedPieces = Array.isArray(pieces)
      ? pieces.map((p) => ({
          key: String(p.key || p.label || "").replace(/\s+/g, ""),
          label: String(p.label || ""),
          title: String(p.title || ""),
          composer: String(p.composer || ""),
        }))
      : [];

    const cycle = await ExamPreparationCycle.create({
      studentId,
      createdByTeacherId: teacherId,
      instrument,
      examType,
      examGrade,
      status,
      pieces: sanitizedPieces,
      examDate: parsedExamDate,
      examLocation: normalizeTrimmedString(examLocation),
      withdrawalReason: normalizeTrimmedString(withdrawalReason),
      closingNote: normalizeTrimmedString(closingNote),
      examTaken,

      // ✅ NEW: initialize progressSummary
      progressSummary: {
        requiredElements,
        completedElements: [],
        completionPercent: 0,
        scoreEntryCount: 0,
        averageScore: null,
        latestScores: {},
        lastScoreEntryAt: null,
        lastLessonAt: null,
        updatedAt: new Date(),
      },
    });

    if (status === "current") {
      await Student.findByIdAndUpdate(studentId, {
        $set: { activeExamCycleId: cycle._id },
      });
    }

    await recomputeExamCycleSummary(cycle._id);
    await recomputeStudentReadModels(studentId);

    await AuditLog.create({
      actorUserId: teacherId,
      actorRoles: Array.isArray(req.user.roles) ? req.user.roles : [],
      action: "CREATE_EXAM_CYCLE",
      targetType: "ExamPreparationCycle",
      targetId: cycle._id,
      studentId,
      metadata: {
        instrument,
        examType,
        examGrade,
        status,
        examDate: parsedExamDate,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    return res.status(201).json({ cycle });
  } catch (err) {
    next(err);
  }
}

export async function updateExamCycle(req, res, next) {
  try {
    const teacherId = req.user._id;
    const { cycleId } = req.params;
    const {
      instrument,
      examType,
      examGrade,
      status,
      examDate,
      examLocation,
      withdrawalReason,
      closingNote,
      examTaken,
      completion,
    } = req.body || {};

    const cycle = await getCycleOrThrow(cycleId);

    await assertTeacherCanEdit(teacherId, cycle.studentId, cycle.instrument);

    if (instrument !== undefined) {
      cycle.instrument = instrument;
    }

    if (examType !== undefined) {
      cycle.examType = examType;
    }

    if (examGrade !== undefined) {
      cycle.examGrade = examGrade;
    }

    if (status !== undefined) {
      cycle.status = status;
    }

    if (examDate !== undefined) {
      const parsedExamDate = examDate ? normalizeDate(examDate) : null;
      if (examDate && !parsedExamDate) {
        return res.status(400).json({ error: "Invalid examDate" });
      }
      cycle.examDate = parsedExamDate;
    }

    if (examLocation !== undefined) {
      cycle.examLocation = normalizeTrimmedString(examLocation);
    }

    if (withdrawalReason !== undefined) {
      cycle.withdrawalReason = normalizeTrimmedString(withdrawalReason);
    }

    if (closingNote !== undefined) {
      cycle.closingNote = normalizeTrimmedString(closingNote);
    }

    if (examTaken !== undefined) {
      cycle.examTaken = examTaken;
    }

    if (completion !== undefined) {
      cycle.completion = completion;
    }

    await cycle.save();

    if (cycle.status === "current") {
      await Student.findByIdAndUpdate(cycle.studentId, {
        $set: { activeExamCycleId: cycle._id },
      });
    }

    await recomputeExamCycleSummary(cycle._id);
    await recomputeStudentReadModels(cycle.studentId);

    await AuditLog.create({
      actorUserId: teacherId,
      actorRoles: Array.isArray(req.user.roles) ? req.user.roles : [],
      action: "UPDATE_EXAM_CYCLE",
      targetType: "ExamPreparationCycle",
      targetId: cycle._id,
      studentId: cycle.studentId,
      metadata: {
        updatedFields: Object.keys(req.body || {}),
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    return res.json({ cycle });
  } catch (err) {
    next(err);
  }
}

export async function setActiveExamCycle(req, res, next) {
  try {
    const teacherId = req.user._id;
    const { studentId, cycleId } = req.params;

    const safeStudentId = validateObjectId(studentId, "studentId");
    const safeCycleId = validateObjectId(cycleId, "cycleId");

    const student = await getStudentOrThrow(safeStudentId);
    const cycle = await getCycleOrThrow(safeCycleId);

    await ensureCycleBelongsToStudent(cycle, student._id);
    await assertTeacherCanEdit(teacherId, safeStudentId, cycle.instrument);

    await Student.findByIdAndUpdate(safeStudentId, {
      $set: { activeExamCycleId: cycle._id },
    });

    if (cycle.status !== "current") {
      cycle.status = "current";
      await cycle.save();
    }

    await recomputeExamCycleSummary(cycle._id);
    await recomputeStudentReadModels(safeStudentId);

    await AuditLog.create({
      actorUserId: teacherId,
      actorRoles: Array.isArray(req.user.roles) ? req.user.roles : [],
      action: "SET_ACTIVE_EXAM_CYCLE",
      targetType: "ExamPreparationCycle",
      targetId: cycle._id,
      studentId: safeStudentId,
      metadata: {
        activeExamCycleId: cycle._id,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    return res.json({
      ok: true,
      activeExamCycleId: cycle._id,
    });
  } catch (err) {
    next(err);
  }
}

export async function listExamCyclesForStudent(req, res, next) {
  try {
    const { studentId } = req.params;
    const { instrument, includeArchived } = req.query;

    const safeStudentId = validateObjectId(studentId, "studentId");

    if (instrument) {
      parseEnum(instrument, ALLOWED_INSTRUMENTS, "instrument");
      await assertTeacherCanView(req.user._id, safeStudentId, instrument);
    } else {
      await assertTeacherHasAnyAccess(req.user._id, safeStudentId);
    }

    const query = {
      studentId: safeStudentId,
    };

    if (!parseBoolean(includeArchived)) {
      query.archivedAt = null;
    }

    if (instrument) {
      query.instrument = instrument;
    }

    const cycles = await ExamPreparationCycle.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ cycles });
  } catch (err) {
    next(err);
  }
}

export async function getExamCycleById(req, res, next) {
  try {
    const { cycleId } = req.params;

    const cycle = await ExamPreparationCycle.findById(cycleId).lean();

    if (!cycle || cycle.archivedAt) {
      return res.status(404).json({ error: "Exam cycle not found" });
    }

    try {
      await assertTeacherCanView(
        req.user._id,
        cycle.studentId,
        cycle.instrument,
      );
    } catch {
      return res.status(404).json({ error: "Exam cycle not found" });
    }

    return res.json({ cycle });
  } catch (err) {
    next(err);
  }
}

export async function completeExamCycle(req, res, next) {
  try {
    const teacherId = req.user._id;
    const { cycleId } = req.params;
    const {
      completion = {},
      closingNote = "",
      examTaken = true,
    } = req.body || {};

    const cycle = await getCycleOrThrow(cycleId);

    await assertTeacherCanEdit(teacherId, cycle.studentId, cycle.instrument);

    cycle.status = "completed";
    cycle.examTaken = examTaken;
    cycle.closingNote = normalizeTrimmedString(closingNote);
    cycle.completion = completion;

    await cycle.save();

    const student = await Student.findById(cycle.studentId).select(
      "_id activeExamCycleId",
    );

    if (
      student &&
      student.activeExamCycleId &&
      String(student.activeExamCycleId) === String(cycle._id)
    ) {
      student.activeExamCycleId = null;
      await student.save();
    }

    await recomputeExamCycleSummary(cycle._id);
    await recomputeStudentReadModels(cycle.studentId);

    await AuditLog.create({
      actorUserId: teacherId,
      actorRoles: Array.isArray(req.user.roles) ? req.user.roles : [],
      action: "COMPLETE_EXAM_CYCLE",
      targetType: "ExamPreparationCycle",
      targetId: cycle._id,
      studentId: cycle.studentId,
      metadata: {
        status: cycle.status,
        examTaken: cycle.examTaken,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    return res.json({ cycle });
  } catch (err) {
    next(err);
  }
}

export async function withdrawExamCycle(req, res, next) {
  try {
    const teacherId = req.user._id;
    const { cycleId } = req.params;
    const { withdrawalReason = "", closingNote = "" } = req.body || {};

    const cycle = await getCycleOrThrow(cycleId);

    await assertTeacherCanEdit(teacherId, cycle.studentId, cycle.instrument);

    cycle.status = "withdrawn";
    cycle.withdrawalReason = normalizeTrimmedString(withdrawalReason);
    cycle.closingNote = normalizeTrimmedString(closingNote);

    await cycle.save();

    const student = await Student.findById(cycle.studentId).select(
      "_id activeExamCycleId",
    );

    if (
      student &&
      student.activeExamCycleId &&
      String(student.activeExamCycleId) === String(cycle._id)
    ) {
      student.activeExamCycleId = null;
      await student.save();
    }

    await recomputeExamCycleSummary(cycle._id);
    await recomputeStudentReadModels(cycle.studentId);

    await AuditLog.create({
      actorUserId: teacherId,
      actorRoles: Array.isArray(req.user.roles) ? req.user.roles : [],
      action: "WITHDRAW_EXAM_CYCLE",
      targetType: "ExamPreparationCycle",
      targetId: cycle._id,
      studentId: cycle.studentId,
      metadata: {
        status: cycle.status,
        withdrawalReason: cycle.withdrawalReason,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    return res.json({ cycle });
  } catch (err) {
    next(err);
  }
}

export async function archiveExamCycle(req, res, next) {
  try {
    const teacherId = req.user._id;
    const { cycleId } = req.params;

    const cycle = await getCycleOrThrow(cycleId);

    await assertTeacherCanEdit(teacherId, cycle.studentId, cycle.instrument);

    cycle.archivedAt = new Date();
    await cycle.save();

    const student = await Student.findById(cycle.studentId).select(
      "_id activeExamCycleId",
    );

    if (
      student &&
      student.activeExamCycleId &&
      String(student.activeExamCycleId) === String(cycle._id)
    ) {
      student.activeExamCycleId = null;
      await student.save();
    }

    await recomputeStudentReadModels(cycle.studentId);

    await AuditLog.create({
      actorUserId: teacherId,
      actorRoles: Array.isArray(req.user.roles) ? req.user.roles : [],
      action: "ARCHIVE_EXAM_CYCLE",
      targetType: "ExamPreparationCycle",
      targetId: cycle._id,
      studentId: cycle.studentId,
      metadata: {
        archivedAt: cycle.archivedAt,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
