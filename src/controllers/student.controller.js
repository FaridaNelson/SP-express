import mongoose from "mongoose";
import Student from "../models/Student.js";
import TeacherStudentAccess from "../models/TeacherStudentAccess.js";
import AuditLog from "../models/AuditLog.js";
import { assertTeacherHasAnyAccess } from "../services/access.service.js";

function normalizeTrimmedString(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export async function createStudent(req, res, next) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const actorUser = req.user;
    const {
      firstName,
      lastName,
      email = "",
      instrument,
      grade,
      parentContactSnapshot = {},
    } = req.body || {};

    const normalizedFirstName = normalizeTrimmedString(firstName);
    const normalizedLastName = normalizeTrimmedString(lastName);
    const normalizedName =
      `${normalizedFirstName} ${normalizedLastName}`.trim();

    if (!normalizedFirstName || !normalizedLastName) {
      await session.abortTransaction();
      return res.status(400).json({
        error: "firstName and lastName are required",
      });
    }

    if (!instrument) {
      await session.abortTransaction();
      return res.status(400).json({ error: "instrument is required" });
    }

    if (grade == null) {
      await session.abortTransaction();
      return res.status(400).json({ error: "grade is required" });
    }

    const [student] = await Student.create(
      [
        {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          name: normalizedName,
          email: normalizeEmail(email),
          instrument,
          grade,
          parentContactSnapshot: {
            firstName: normalizeTrimmedString(parentContactSnapshot.firstName),
            lastName: normalizeTrimmedString(parentContactSnapshot.lastName),
            name: normalizeTrimmedString(parentContactSnapshot.name),
            email: normalizeEmail(parentContactSnapshot.email),
            phone: normalizeTrimmedString(parentContactSnapshot.phone),
          },
        },
      ],
      { session },
    );

    await TeacherStudentAccess.create(
      [
        {
          studentId: student._id,
          teacherId: actorUser._id,
          instrument: student.instrument,
          status: "active",
          role: "primary",
          grantedByUserId: actorUser._id,
          note: "Initial primary teacher created with student record",
        },
      ],
      { session },
    );

    await AuditLog.create(
      [
        {
          actorUserId: actorUser._id,
          actorRoles: Array.isArray(actorUser.roles) ? actorUser.roles : [],
          action: "CREATE_STUDENT",
          targetType: "Student",
          targetId: student._id,
          studentId: student._id,
          metadata: {
            instrument,
            grade,
            createdInitialPrimaryAccess: true,
          },
          ipAddress: req.ip,
          userAgent: req.get("user-agent") || "",
        },
      ],
      { session },
    );

    await session.commitTransaction();
    return res.status(201).json({ student });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
}

export async function getStudentById(req, res, next) {
  try {
    const { studentId } = req.params;

    await assertTeacherHasAnyAccess(req.user._id, studentId);

    const student = await Student.findById(studentId).lean();

    if (!student || student.archivedAt || student.status === "archived") {
      return res.status(404).json({ error: "Student not found" });
    }

    return res.json({ student });
  } catch (err) {
    next(err);
  }
}

export async function updateStudent(req, res, next) {
  try {
    const { studentId } = req.params;
    const updates = req.body || {};

    await assertTeacherHasAnyAccess(req.user._id, studentId);

    const student = await Student.findById(studentId);
    if (!student || student.archivedAt || student.status === "archived") {
      return res.status(404).json({ error: "Student not found" });
    }

    if (updates.firstName !== undefined) {
      student.firstName = normalizeTrimmedString(updates.firstName);
    }

    if (updates.lastName !== undefined) {
      student.lastName = normalizeTrimmedString(updates.lastName);
    }

    if (updates.email !== undefined) {
      student.email = normalizeEmail(updates.email);
    }

    if (updates.grade !== undefined) {
      student.grade = updates.grade;
    }

    student.name = `${student.firstName} ${student.lastName}`.trim();

    if (updates.parentContactSnapshot !== undefined) {
      const pcs = updates.parentContactSnapshot || {};
      student.parentContactSnapshot = {
        firstName: normalizeTrimmedString(pcs.firstName),
        lastName: normalizeTrimmedString(pcs.lastName),
        name: normalizeTrimmedString(pcs.name),
        email: normalizeEmail(pcs.email),
        phone: normalizeTrimmedString(pcs.phone),
      };
    }

    await student.save();

    return res.json({ student });
  } catch (err) {
    next(err);
  }
}

export async function archiveStudent(req, res, next) {
  try {
    const { studentId } = req.params;

    await assertTeacherHasAnyAccess(req.user._id, studentId);

    const student = await Student.findById(studentId);
    if (!student || student.archivedAt || student.status === "archived") {
      return res.status(404).json({ error: "Student not found" });
    }

    student.status = "archived";
    student.archivedAt = new Date();
    await student.save();

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
