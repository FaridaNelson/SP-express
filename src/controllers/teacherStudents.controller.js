import Student from "../models/Student.js";
import {
  validateInstrument,
  validateGradeRequired,
} from "../utils/validators/student.validators.js";

const DEFAULT_ITEMS = [
  { id: "scales", label: "Scales", weight: 14, score: 0 },
  { id: "pieceA", label: "Piece A", weight: 20, score: 0 },
  { id: "pieceB", label: "Piece B", weight: 20, score: 0 },
  { id: "pieceC", label: "Piece C", weight: 20, score: 0 },
  { id: "sightReading", label: "Sight Reading", weight: 14, score: 0 },
  { id: "auralTraining", label: "Aural Training", weight: 12, score: 0 },
];

function getTeacherId(req) {
  return req.user?._id;
}

export async function listStudents(req, res, next) {
  try {
    const teacherId = getTeacherId(req);

    const list = await Student.find({ teacherId })
      .select(
        "_id firstName lastName name inviteCode email instrument grade parent parentIds teacherId activeExamCycleId",
      )
      .populate({
        path: "parentIds",
        select: "_id firstName lastName name email phone roles status",
      })
      .populate({
        path: "teacherId",
        select: "_id firstName lastName name email",
      })
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    return res.status(200).json({ students: list });
  } catch (e) {
    next(e);
  }
}

export async function getProgress(req, res, next) {
  try {
    const teacherId = getTeacherId(req);

    const stu = await Student.findOne({ _id: req.params.id, teacherId })
      .select("_id progressItems")
      .lean();

    if (!stu) {
      return res.status(404).json({ error: "Student not found" });
    }

    return res.json({
      items: stu.progressItems?.length ? stu.progressItems : DEFAULT_ITEMS,
    });
  } catch (e) {
    next(e);
  }
}

export async function setProgress(req, res, next) {
  try {
    const teacherId = getTeacherId(req);
    const { items } = req.body || {};

    if (!Array.isArray(items)) {
      return res.status(400).json({ error: "items[] required" });
    }

    const stu = await Student.findOneAndUpdate(
      { _id: req.params.id, teacherId },
      { $set: { progressItems: items } },
      { new: true, projection: "_id progressItems" },
    ).lean();

    if (!stu) {
      return res.status(404).json({ error: "Student not found" });
    }

    return res.status(200).json({ items: stu.progressItems });
  } catch (e) {
    next(e);
  }
}

export async function createStudent(req, res, next) {
  try {
    const teacherId = getTeacherId(req);

    const { firstName, lastName, email, instrument, grade, parent } =
      req.body || {};

    const studentFirstName = String(firstName || "").trim();
    const studentLastName = String(lastName || "").trim();
    const fullStudentName = `${studentFirstName} ${studentLastName}`.trim();

    if (!studentFirstName || !studentLastName) {
      return res.status(400).json({
        error: "Student first name and last name are required",
      });
    }

    const inst = validateInstrument(instrument);
    if (!inst.ok) return res.status(400).json({ error: inst.message });

    const grd = validateGradeRequired(grade);
    if (!grd.ok) return res.status(400).json({ error: grd.message });

    const parentFirstName = String(parent?.firstName || "").trim();
    const parentLastName = String(parent?.lastName || "").trim();
    const parentPhone = String(parent?.phone || "").trim();
    const fullParentName =
      String(parent?.name || "").trim() ||
      `${parentFirstName} ${parentLastName}`.trim();

    const doc = await Student.create({
      firstName: studentFirstName,
      lastName: studentLastName,
      name: fullStudentName,
      email: email ? String(email).trim().toLowerCase() : "",
      instrument: inst.value,
      grade: grd.value,
      parent: {
        firstName: parentFirstName,
        lastName: parentLastName,
        name: fullParentName,
        email: parent?.email ? String(parent.email).trim().toLowerCase() : "",
        phone: parentPhone,
      },
      teacherId,
    });

    return res.status(201).json({ student: doc });
  } catch (e) {
    next(e);
  }
}
