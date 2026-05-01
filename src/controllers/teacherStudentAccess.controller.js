import mongoose from "mongoose";
import TeacherStudentAccess from "../models/TeacherStudentAccess.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import StudentDashboardSummary from "../models/StudentDashboardSummary.js";
import { recomputeStudentDashboardSummary } from "../services/summary.service.js";
import { VALID_INSTRUMENTS } from "../constants/instruments.js";
import {
  VALID_ACCESS_ROLES,
  VALID_ASSIGNABLE_ROLES,
  VALID_ACCESS_STATUSES,
} from "../constants/access.js";

function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function hasRole(user, role) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roles.includes(role);
}

function isAdmin(user) {
  return hasRole(user, "admin");
}

function isTeacher(user) {
  return hasRole(user, "teacher");
}

function normalizeTrimmedString(value) {
  return String(value || "").trim();
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function toObjectIdOrThrow(value, fieldName) {
  if (!isValidObjectId(value)) {
    throw createHttpError(400, `Invalid ${fieldName}`);
  }

  return new mongoose.Types.ObjectId(String(value));
}

function validateInstrument(instrument) {
  return VALID_INSTRUMENTS.includes(String(instrument || "").trim());
}

function getSafeInstrumentOrThrow(instrument) {
  const normalized = normalizeTrimmedString(instrument);

  if (normalized === "Piano") return "Piano";
  if (normalized === "Voice") return "Voice";
  if (normalized === "Guitar") return "Guitar";

  throw createHttpError(400, "Invalid instrument");
}

function getSafeOptionalInstrument(instrument) {
  if (!instrument) return undefined;
  return getSafeInstrumentOrThrow(instrument);
}

function getSafeAssignableRoleOrThrow(role) {
  if (role === "collaborator") return "collaborator";
  if (role === "viewer") return "viewer";

  throw createHttpError(400, 'role must be either "collaborator" or "viewer"');
}

function getSafeOptionalAccessRole(role) {
  if (!role) return undefined;

  if (role === "primary") return "primary";
  if (role === "collaborator") return "collaborator";
  if (role === "viewer") return "viewer";

  throw createHttpError(400, "Invalid role");
}

function getSafeAccessStatus(status = "active") {
  if (!status || status === "active") return "active";
  if (status === "revoked") return "revoked";

  throw createHttpError(400, "Invalid status");
}

async function getStudentOrThrow(studentId, session = null) {
  const safeStudentId = toObjectIdOrThrow(studentId, "studentId");

  const student = await Student.findById(safeStudentId)
    .select("_id status archivedAt")
    .session(session);

  if (!student || student.archivedAt || student.status === "archived") {
    throw createHttpError(404, "Student not found");
  }

  return student;
}

async function getTeacherOrThrow(teacherId, session = null) {
  const safeTeacherId = toObjectIdOrThrow(teacherId, "teacherId");

  const teacher = await User.findById(safeTeacherId)
    .select("_id roles status deletedAt firstName lastName name email")
    .session(session);

  if (!teacher || teacher.deletedAt || teacher.status !== "active") {
    throw createHttpError(404, "Teacher not found");
  }

  const roles = Array.isArray(teacher.roles) ? teacher.roles : [];
  if (!roles.includes("teacher")) {
    throw createHttpError(400, "User is not a teacher");
  }

  return teacher;
}

async function getActiveAccessForStudentInstrument(
  studentId,
  instrument,
  session = null,
) {
  const safeStudentId = toObjectIdOrThrow(studentId, "studentId");
  const safeInstrument = getSafeInstrumentOrThrow(instrument);

  return TeacherStudentAccess.find({
    studentId: safeStudentId,
    instrument: safeInstrument,
    status: "active",
    endedAt: null,
  })
    .sort({ role: 1, startedAt: -1 })
    .session(session)
    .lean();
}

async function getPrimaryAccessForStudentInstrument(
  studentId,
  instrument,
  session = null,
) {
  const safeStudentId = toObjectIdOrThrow(studentId, "studentId");
  const safeInstrument = getSafeInstrumentOrThrow(instrument);

  return TeacherStudentAccess.findOne({
    studentId: safeStudentId,
    instrument: safeInstrument,
    status: "active",
    endedAt: null,
    role: "primary",
  }).session(session);
}

async function assertActorCanManageStudentAccess(
  actorUser,
  studentId,
  instrument,
  session = null,
) {
  if (!actorUser?._id) {
    throw createHttpError(401, "Unauthenticated");
  }

  const safeStudentId = toObjectIdOrThrow(studentId, "studentId");
  const safeInstrument = getSafeInstrumentOrThrow(instrument);

  if (isAdmin(actorUser)) {
    return true;
  }

  if (!isTeacher(actorUser)) {
    throw createHttpError(403, "Forbidden");
  }

  const activePrimary = await TeacherStudentAccess.findOne({
    studentId: safeStudentId,
    instrument: safeInstrument,
    teacherId: actorUser._id,
    status: "active",
    endedAt: null,
    role: "primary",
  }).session(session);

  if (!activePrimary) {
    throw createHttpError(
      403,
      "Only the active primary teacher or admin can manage teacher access for this instrument",
    );
  }

  return true;
}

async function writeAuditLog({
  actorUser,
  action,
  targetId,
  studentId,
  metadata,
  req,
  session = null,
}) {
  await AuditLog.create(
    [
      {
        actorUserId: actorUser._id,
        actorRoles: Array.isArray(actorUser.roles) ? actorUser.roles : [],
        action,
        targetType: "TeacherStudentAccess",
        targetId,
        studentId,
        metadata: metadata || {},
        ipAddress: req?.ip || "",
        userAgent: req?.get?.("user-agent") || "",
      },
    ],
    { session },
  );
}

export async function assignPrimaryTeacher(req, res, next) {
  const session = await mongoose.startSession();

  try {
    const actorUser = req.user;
    const { studentId } = req.params;
    const { teacherId, instrument, note = "" } = req.body || {};

    const safeStudentId = toObjectIdOrThrow(studentId, "studentId");
    const safeTeacherId = toObjectIdOrThrow(teacherId, "teacherId");
    const safeInstrument = getSafeInstrumentOrThrow(instrument);
    const safeNote = normalizeTrimmedString(note);

    let responsePayload = null;

    await session.withTransaction(async () => {
      await assertActorCanManageStudentAccess(
        actorUser,
        safeStudentId,
        safeInstrument,
        session,
      );
      await getStudentOrThrow(safeStudentId, session);
      await getTeacherOrThrow(safeTeacherId, session);

      const currentPrimary = await getPrimaryAccessForStudentInstrument(
        safeStudentId,
        safeInstrument,
        session,
      );

      if (
        currentPrimary &&
        String(currentPrimary.teacherId) === String(safeTeacherId)
      ) {
        throw createHttpError(
          400,
          "This teacher is already the primary teacher for this instrument",
        );
      }

      if (currentPrimary) {
        currentPrimary.status = "inactive";
        currentPrimary.endedAt = new Date();
        currentPrimary.revokedByUserId = actorUser._id;
        currentPrimary.note = normalizeTrimmedString(
          `${currentPrimary.note ? `${currentPrimary.note}\n` : ""}Primary role ended`,
        );
        await currentPrimary.save({ session });

        await writeAuditLog({
          actorUser,
          action: "REVOKE_PRIMARY_TEACHER",
          targetId: currentPrimary._id,
          studentId: safeStudentId,
          metadata: {
            previousTeacherId: currentPrimary.teacherId,
            instrument: safeInstrument,
            reason: "Replaced by new primary teacher",
          },
          req,
          session,
        });
      }

      const existingActiveRow = await TeacherStudentAccess.findOne({
        studentId: safeStudentId,
        teacherId: safeTeacherId,
        instrument: safeInstrument,
        status: "active",
        endedAt: null,
      }).session(session);

      let primaryAccess;

      if (existingActiveRow) {
        existingActiveRow.role = "primary";
        existingActiveRow.note = safeNote;
        await existingActiveRow.save({ session });
        primaryAccess = existingActiveRow;
      } else {
        primaryAccess = await TeacherStudentAccess.create(
          [
            {
              studentId: safeStudentId,
              teacherId: safeTeacherId,
              instrument: safeInstrument,
              status: "active",
              role: "primary",
              startedAt: new Date(),
              endedAt: null,
              grantedByUserId: actorUser._id,
              revokedByUserId: null,
              note: safeNote,
            },
          ],
          { session },
        ).then((docs) => docs[0]);
      }

      await writeAuditLog({
        actorUser,
        action: "ASSIGN_PRIMARY_TEACHER",
        targetId: primaryAccess._id,
        studentId: safeStudentId,
        metadata: {
          teacherId: safeTeacherId,
          instrument: safeInstrument,
          role: "primary",
          note: safeNote,
        },
        req,
        session,
      });

      responsePayload = {
        ok: true,
        access: primaryAccess,
      };
    });

    await recomputeStudentDashboardSummary(safeStudentId);

    return res.status(200).json(responsePayload);
  } catch (err) {
    next(err);
  } finally {
    session.endSession();
  }
}

export async function addTeacherAccess(req, res, next) {
  const session = await mongoose.startSession();

  try {
    const actorUser = req.user;
    const { studentId } = req.params;
    const {
      teacherId,
      instrument,
      role = "collaborator",
      note = "",
    } = req.body || {};

    const safeStudentId = toObjectIdOrThrow(studentId, "studentId");
    const safeTeacherId = toObjectIdOrThrow(teacherId, "teacherId");
    const safeInstrument = getSafeInstrumentOrThrow(instrument);
    const safeRole = getSafeAssignableRoleOrThrow(role);
    const safeNote = normalizeTrimmedString(note);

    let responsePayload = null;

    await session.withTransaction(async () => {
      await assertActorCanManageStudentAccess(
        actorUser,
        safeStudentId,
        safeInstrument,
        session,
      );
      await getStudentOrThrow(safeStudentId, session);
      await getTeacherOrThrow(safeTeacherId, session);

      const existingActive = await TeacherStudentAccess.findOne({
        studentId: safeStudentId,
        teacherId: safeTeacherId,
        instrument: safeInstrument,
        status: "active",
        endedAt: null,
      }).session(session);

      if (existingActive) {
        throw createHttpError(
          400,
          "This teacher already has active access to the student for this instrument",
        );
      }

      const access = await TeacherStudentAccess.create(
        [
          {
            studentId: safeStudentId,
            teacherId: safeTeacherId,
            instrument: safeInstrument,
            status: "active",
            role: safeRole,
            startedAt: new Date(),
            endedAt: null,
            grantedByUserId: actorUser._id,
            revokedByUserId: null,
            note: safeNote,
          },
        ],
        { session },
      ).then((docs) => docs[0]);

      await writeAuditLog({
        actorUser,
        action: "ADD_TEACHER_ACCESS",
        targetId: access._id,
        studentId: safeStudentId,
        metadata: {
          teacherId: safeTeacherId,
          instrument: safeInstrument,
          role: safeRole,
          note: safeNote,
        },
        req,
        session,
      });

      responsePayload = {
        ok: true,
        access,
      };
    });

    await recomputeStudentDashboardSummary(safeStudentId);

    return res.status(201).json(responsePayload);
  } catch (err) {
    next(err);
  } finally {
    session.endSession();
  }
}

export async function revokeTeacherAccess(req, res, next) {
  const session = await mongoose.startSession();

  try {
    const actorUser = req.user;
    const { studentId, accessId } = req.params;
    const { note = "" } = req.body || {};

    const safeStudentId = toObjectIdOrThrow(studentId, "studentId");
    const safeAccessId = toObjectIdOrThrow(accessId, "accessId");
    const safeNote = normalizeTrimmedString(note);

    let responsePayload = null;

    await session.withTransaction(async () => {
      const access =
        await TeacherStudentAccess.findById(safeAccessId).session(session);
      if (!access) {
        throw createHttpError(404, "Access row not found");
      }

      if (String(access.studentId) !== String(safeStudentId)) {
        throw createHttpError(
          400,
          "Access row does not belong to this student",
        );
      }

      await assertActorCanManageStudentAccess(
        actorUser,
        safeStudentId,
        access.instrument,
        session,
      );

      if (access.status !== "active" || access.endedAt) {
        throw createHttpError(400, "Access is already inactive");
      }

      if (access.role === "primary") {
        throw createHttpError(
          400,
          "Cannot revoke primary teacher access from this endpoint. Assign a new primary teacher instead.",
        );
      }

      access.status = "revoked";
      access.endedAt = new Date();
      access.revokedByUserId = actorUser._id;
      access.note = normalizeTrimmedString(
        `${access.note ? `${access.note}\n` : ""}${safeNote}`,
      );

      await access.save({ session });

      await writeAuditLog({
        actorUser,
        action: "REVOKE_TEACHER_ACCESS",
        targetId: access._id,
        studentId: safeStudentId,
        metadata: {
          teacherId: access.teacherId,
          instrument: access.instrument,
          previousRole: access.role,
          note: safeNote,
        },
        req,
        session,
      });

      responsePayload = {
        ok: true,
        access,
      };
    });

    await recomputeStudentDashboardSummary(safeStudentId);

    return res.status(200).json(responsePayload);
  } catch (err) {
    next(err);
  } finally {
    session.endSession();
  }
}

export async function listTeacherAccessForStudent(req, res, next) {
  try {
    const actorUser = req.user;
    const { studentId } = req.params;
    const { instrument } = req.query;

    const safeStudentId = toObjectIdOrThrow(studentId, "studentId");
    const safeInstrument = getSafeOptionalInstrument(instrument);

    if (safeInstrument) {
      await assertActorCanManageStudentAccess(
        actorUser,
        safeStudentId,
        safeInstrument,
      );
    } else {
      if (!actorUser?._id) {
        return res.status(401).json({ error: "Unauthenticated" });
      }

      if (!isAdmin(actorUser)) {
        throw createHttpError(
          403,
          "Instrument is required unless the actor is an admin",
        );
      }
    }

    const query = safeInstrument
      ? { studentId: safeStudentId, instrument: safeInstrument }
      : { studentId: safeStudentId };

    const accessRows = await TeacherStudentAccess.find(query)
      .populate("teacherId", "_id firstName lastName name email roles status")
      .populate("grantedByUserId", "_id firstName lastName name email")
      .populate("revokedByUserId", "_id firstName lastName name email")
      .sort({ instrument: 1, status: 1, role: 1, startedAt: -1 })
      .lean();

    return res.json({ accessRows });
  } catch (err) {
    next(err);
  }
}

export async function listStudentsForTeacher(req, res, next) {
  try {
    const actorUser = req.user;
    const teacherId = req.params.teacherId || actorUser._id;
    const { role, status = "active", instrument } = req.query;

    const safeTeacherId = toObjectIdOrThrow(teacherId, "teacherId");
    const safeStatus = getSafeAccessStatus(status);
    const safeRole = getSafeOptionalAccessRole(role);
    const safeInstrument = getSafeOptionalInstrument(instrument);

    if (
      !isAdmin(actorUser) &&
      String(actorUser._id) !== String(safeTeacherId)
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    let accessRowsQuery;

    if (safeRole && safeInstrument) {
      accessRowsQuery = TeacherStudentAccess.find({
        teacherId: safeTeacherId,
        status: safeStatus,
        role: safeRole,
        instrument: safeInstrument,
      });
    } else if (safeRole) {
      accessRowsQuery = TeacherStudentAccess.find({
        teacherId: safeTeacherId,
        status: safeStatus,
        role: safeRole,
      });
    } else if (safeInstrument) {
      accessRowsQuery = TeacherStudentAccess.find({
        teacherId: safeTeacherId,
        status: safeStatus,
        instrument: safeInstrument,
      });
    } else {
      accessRowsQuery = TeacherStudentAccess.find({
        teacherId: safeTeacherId,
        status: safeStatus,
      });
    }

    const accessRows = await accessRowsQuery
      .populate({
        path: "studentId",
        select:
          "_id firstName lastName name email instrument grade status activeExamCycleId",
      })
      .sort({ instrument: 1, role: 1, startedAt: -1 })
      .lean();

    const filtered = accessRows.filter((row) => row.studentId);

    const studentIds = filtered.map((row) => row.studentId._id);
    const summaries = await StudentDashboardSummary.find({
      studentId: { $in: studentIds },
    })
      .select("studentId activeCycleProgressPercent activeCycleStatus")
      .lean();

    const summaryMap = new Map(
      summaries.map((s) => [s.studentId.toString(), s]),
    );

    const students = filtered.map((row) => ({
      accessId: row._id,
      instrument: row.instrument,
      role: row.role,
      status: row.status,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      note: row.note,
      student: row.studentId,
      summary: summaryMap.get(row.studentId._id.toString()) ?? null,
    }));

    return res.json({ students });
  } catch (err) {
    next(err);
  }
}
