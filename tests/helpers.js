import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Student from "../src/models/Student.js";
import TeacherStudentAccess from "../src/models/TeacherStudentAccess.js";
import ExamPreparationCycle from "../src/models/ExamPreparationCycle.js";

const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

export function generateToken(userId, roles = ["teacher"]) {
  return jwt.sign(
    { sub: userId.toString(), roles },
    JWT_SECRET,
    { expiresIn: "1d" },
  );
}

export function fakeId() {
  return new mongoose.Types.ObjectId().toString();
}

export async function createTestTeacher(overrides = {}) {
  const passwordHash = await bcrypt.hash("password123", 4);
  const user = await User.create({
    firstName: "Test",
    lastName: "Teacher",
    name: "Test Teacher",
    email: `teacher-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    passwordHash,
    roles: ["teacher"],
    studioName: "Test Studio",
    instrumentsTaught: ["Piano"],
    yearsTeaching: "3-5",
    ...overrides,
  });
  const token = generateToken(user._id, user.roles);
  return { user, token };
}

export async function createTestAdmin(overrides = {}) {
  const passwordHash = await bcrypt.hash("password123", 4);
  const user = await User.create({
    firstName: "Admin",
    lastName: "User",
    name: "Admin User",
    email: `admin-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    passwordHash,
    roles: ["admin"],
    ...overrides,
  });
  const token = generateToken(user._id, user.roles);
  return { user, token };
}

export async function createTestParent(overrides = {}) {
  const passwordHash = await bcrypt.hash("password123", 4);
  const user = await User.create({
    firstName: "Parent",
    lastName: "User",
    name: "Parent User",
    email: `parent-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    passwordHash,
    roles: ["parent"],
    ...overrides,
  });
  const token = generateToken(user._id, user.roles);
  return { user, token };
}

export async function createTestStudentUser(overrides = {}) {
  const passwordHash = await bcrypt.hash("password123", 4);
  const user = await User.create({
    firstName: "Student",
    lastName: "User",
    name: "Student User",
    email: `student-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    passwordHash,
    roles: ["student"],
    instrument: "Piano",
    ...overrides,
  });
  const token = generateToken(user._id, user.roles);
  return { user, token };
}

export async function createTestStudent(teacherId, overrides = {}) {
  const student = await Student.create({
    firstName: "Test",
    lastName: "Student",
    name: "Test Student",
    email: "student@test.com",
    instrument: "Piano",
    grade: 3,
    ...overrides,
  });

  await TeacherStudentAccess.create({
    studentId: student._id,
    teacherId,
    instrument: student.instrument,
    status: "active",
    role: "primary",
    startedAt: new Date(),
    grantedByUserId: teacherId,
  });

  return student;
}

export async function createTestExamCycle(studentId, teacherId, overrides = {}) {
  const examType = overrides.examType || "Practical";
  const requiredElements =
    examType === "Performance"
      ? ["pieceA", "pieceB", "pieceC", "pieceD"]
      : ["pieceA", "pieceB", "pieceC", "scales", "sightReading", "auralTraining"];

  const cycle = await ExamPreparationCycle.create({
    studentId,
    createdByTeacherId: teacherId,
    instrument: "Piano",
    examType,
    examGrade: 3,
    status: "current",
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
    ...overrides,
  });

  return cycle;
}
