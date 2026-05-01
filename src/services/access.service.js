import mongoose from "mongoose";
import TeacherStudentAccess from "../models/TeacherStudentAccess.js";
import { VALID_INSTRUMENTS } from "../constants/instruments.js";

function createForbiddenError(message) {
  const err = new Error(message);
  err.status = 403;
  return err;
}

export async function getTeacherAccess(teacherId, studentId, instrument) {
  const now = new Date();

  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    const err = new Error("Invalid teacherId");
    err.status = 400;
    throw err;
  }

  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    const err = new Error("Invalid studentId");
    err.status = 400;
    throw err;
  }
  if (!VALID_INSTRUMENTS.includes(instrument)) {
    const err = new Error("Invalid instrument");
    err.status = 400;
    throw err;
  }

  const safeInstrument = VALID_INSTRUMENTS.find((item) => item === instrument);
  const safeTeacherId = new mongoose.Types.ObjectId(teacherId);
  const safeStudentId = new mongoose.Types.ObjectId(studentId);

  return TeacherStudentAccess.findOne({
    teacherId: safeTeacherId,
    studentId: safeStudentId,
    instrument: safeInstrument,
    status: "active",
    startedAt: { $lte: now },
    $or: [{ endedAt: null }, { endedAt: { $gt: now } }],
  }).lean();
}

export async function getTeacherAnyAccess(teacherId, studentId) {
  const now = new Date();

  if (!mongoose.Types.ObjectId.isValid(teacherId)) {
    const err = new Error("Invalid teacherId");
    err.status = 400;
    throw err;
  }

  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    const err = new Error("Invalid studentId");
    err.status = 400;
    throw err;
  }

  const safeTeacherId = new mongoose.Types.ObjectId(teacherId);
  const safeStudentId = new mongoose.Types.ObjectId(studentId);

  return TeacherStudentAccess.findOne({
    teacherId: safeTeacherId,
    studentId: safeStudentId,
    status: "active",
    startedAt: { $lte: now },
    $or: [{ endedAt: null }, { endedAt: { $gt: now } }],
  }).lean();
}

export async function assertTeacherCanEdit(teacherId, studentId, instrument) {
  const access = await getTeacherAccess(teacherId, studentId, instrument);

  if (!access) {
    throw createForbiddenError("No access to this student for this instrument");
  }

  if (!["primary", "collaborator"].includes(access.role)) {
    throw createForbiddenError("Insufficient permissions");
  }

  return access;
}

export async function assertTeacherCanView(teacherId, studentId, instrument) {
  const access = await getTeacherAccess(teacherId, studentId, instrument);

  if (!access) {
    throw createForbiddenError("No access to this student for this instrument");
  }

  return access;
}

export async function assertTeacherHasAnyAccess(teacherId, studentId) {
  const access = await getTeacherAnyAccess(teacherId, studentId);

  if (!access) {
    throw createForbiddenError("No access to this student");
  }

  return access;
}

export async function assertTeacherHasPrimaryAccess(
  teacherId,
  studentId,
  instrument,
) {
  const access = await getTeacherAccess(teacherId, studentId, instrument);

  if (!access) {
    throw createForbiddenError("No access to this student for this instrument");
  }

  if (access.role !== "primary") {
    throw createForbiddenError("Primary teacher access required");
  }

  return access;
}
