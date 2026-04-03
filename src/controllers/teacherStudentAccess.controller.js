import mongoose from "mongoose";
import TeacherStudentAccess from "../models/TeacherStudentAccess.js";
import Student from "../models/Student.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import StudentDashboardSummary from "../models/StudentDashboardSummary.js";
import { recomputeStudentDashboardSummary } from "../services/summary.service.js";

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

function validateInstrument(instrument) {
  const allowed = ["Piano", "Voice", "Guitar"];
  return allowed.includes(String(instrument || "").trim());
}

async function getStudentOrThrow(studentId, session = null) {
  const student = await Student.findById(studentId)
    .select("_id status archivedAt")
    .session(session);

  if (!student || student.archivedAt || student.status === "archived") {
    throw createHttpError(404, "Student not found");
  }

  return student;
}

async function getTeacherOrThrow(teacherId, session = null) {
  const teacher = await User.findById(teacherId)
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
  return TeacherStudentAccess.find({
    studentId,
    instrument,
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
  return TeacherStudentAccess.findOne({
    studentId,
    instrument,
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

  if (!validateInstrument(instrument)) {
    throw createHttpError(400, "Invalid instrument");
  }

  if (isAdmin(actorUser)) {
    return true;
  }

  if (!isTeacher(actorUser)) {
    throw createHttpError(403, "Forbidden");
  }

  const activePrimary = await TeacherStudentAccess.findOne({
    studentId,
    instrument,
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

    if (!isValidObjectId(studentId) || !isValidObjectId(teacherId)) {
      return res.status(400).json({ error: "Invalid studentId or teacherId" });
    }

    if (!validateInstrument(instrument)) {
      return res.status(400).json({ error: "Invalid instrument" });
    }

    let responsePayload = null;

    await session.withTransaction(async () => {
      await assertActorCanManageStudentAccess(
        actorUser,
        studentId,
        instrument,
        session,
      );
      await getStudentOrThrow(studentId, session);
      await getTeacherOrThrow(teacherId, session);

      const currentPrimary = await getPrimaryAccessForStudentInstrument(
        studentId,
        instrument,
        session,
      );

      if (
        currentPrimary &&
        String(currentPrimary.teacherId) === String(teacherId)
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
          studentId,
          metadata: {
            previousTeacherId: currentPrimary.teacherId,
            instrument,
            reason: "Replaced by new primary teacher",
          },
          req,
          session,
        });
      }

      const existingActiveRow = await TeacherStudentAccess.findOne({
        studentId,
        teacherId,
        instrument,
        status: "active",
        endedAt: null,
      }).session(session);

      let primaryAccess;

      if (existingActiveRow) {
        existingActiveRow.role = "primary";
        existingActiveRow.note = normalizeTrimmedString(note);
        await existingActiveRow.save({ session });
        primaryAccess = existingActiveRow;
      } else {
        primaryAccess = await TeacherStudentAccess.create(
          [
            {
              studentId,
              teacherId,
              instrument,
              status: "active",
              role: "primary",
              startedAt: new Date(),
              endedAt: null,
              grantedByUserId: actorUser._id,
              revokedByUserId: null,
              note: normalizeTrimmedString(note),
            },
          ],
          { session },
        ).then((docs) => docs[0]);
      }

      await writeAuditLog({
        actorUser,
        action: "ASSIGN_PRIMARY_TEACHER",
        targetId: primaryAccess._id,
        studentId,
        metadata: {
          teacherId,
          instrument,
          role: "primary",
          note: normalizeTrimmedString(note),
        },
        req,
        session,
      });

      responsePayload = {
        ok: true,
        access: primaryAccess,
      };
    });

    await recomputeStudentDashboardSummary(studentId);

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

    if (!isValidObjectId(studentId) || !isValidObjectId(teacherId)) {
      return res.status(400).json({ error: "Invalid studentId or teacherId" });
    }

    if (!validateInstrument(instrument)) {
      return res.status(400).json({ error: "Invalid instrument" });
    }

    if (!["collaborator", "viewer"].includes(role)) {
      return res.status(400).json({
        error: 'role must be either "collaborator" or "viewer"',
      });
    }

    let responsePayload = null;

    await session.withTransaction(async () => {
      await assertActorCanManageStudentAccess(
        actorUser,
        studentId,
        instrument,
        session,
      );
      await getStudentOrThrow(studentId, session);
      await getTeacherOrThrow(teacherId, session);

      const existingActive = await TeacherStudentAccess.findOne({
        studentId,
        teacherId,
        instrument,
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
            studentId,
            teacherId,
            instrument,
            status: "active",
            role,
            startedAt: new Date(),
            endedAt: null,
            grantedByUserId: actorUser._id,
            revokedByUserId: null,
            note: normalizeTrimmedString(note),
          },
        ],
        { session },
      ).then((docs) => docs[0]);

      await writeAuditLog({
        actorUser,
        action: "ADD_TEACHER_ACCESS",
        targetId: access._id,
        studentId,
        metadata: {
          teacherId,
          instrument,
          role,
          note: normalizeTrimmedString(note),
        },
        req,
        session,
      });

      responsePayload = {
        ok: true,
        access,
      };
    });

    await recomputeStudentDashboardSummary(studentId);

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

    if (!isValidObjectId(studentId) || !isValidObjectId(accessId)) {
      return res.status(400).json({ error: "Invalid studentId or accessId" });
    }

    let responsePayload = null;

    await session.withTransaction(async () => {
      const access =
        await TeacherStudentAccess.findById(accessId).session(session);
      if (!access) {
        throw createHttpError(404, "Access row not found");
      }

      if (String(access.studentId) !== String(studentId)) {
        throw createHttpError(
          400,
          "Access row does not belong to this student",
        );
      }

      await assertActorCanManageStudentAccess(
        actorUser,
        studentId,
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
        `${access.note ? `${access.note}\n` : ""}${normalizeTrimmedString(note)}`,
      );

      await access.save({ session });

      await writeAuditLog({
        actorUser,
        action: "REVOKE_TEACHER_ACCESS",
        targetId: access._id,
        studentId,
        metadata: {
          teacherId: access.teacherId,
          instrument: access.instrument,
          previousRole: access.role,
          note: normalizeTrimmedString(note),
        },
        req,
        session,
      });

      responsePayload = {
        ok: true,
        access,
      };
    });

    await recomputeStudentDashboardSummary(studentId);

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

    if (!isValidObjectId(studentId)) {
      return res.status(400).json({ error: "Invalid studentId" });
    }

    if (instrument && !validateInstrument(instrument)) {
      return res.status(400).json({ error: "Invalid instrument" });
    }

    if (instrument) {
      await assertActorCanManageStudentAccess(actorUser, studentId, instrument);
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

    const query = { studentId };
    if (instrument) {
      query.instrument = instrument;
    }

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

    if (!isValidObjectId(teacherId)) {
      return res.status(400).json({ error: "Invalid teacherId" });
    }

    if (instrument && !validateInstrument(instrument)) {
      return res.status(400).json({ error: "Invalid instrument" });
    }

    const VALID_ROLES = ["primary", "collaborator", "viewer"];
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const VALID_STATUSES = ["active", "revoked"];
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (!isAdmin(actorUser) && String(actorUser._id) !== String(teacherId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const query = { teacherId };

    if (status) {
      query.status = status;
    }

    if (role) {
      query.role = role;
    }

    if (instrument) {
      query.instrument = instrument;
    }

    const accessRows = await TeacherStudentAccess.find(query)
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
      summaries.map((s) => [s.studentId.toString(), s])
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
