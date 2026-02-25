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
  // keep same behavior
  return req.userId;
}

export async function listStudents(req, res, next) {
  try {
    const teacherId = getTeacherId(req);

    const list = await Student.find({ teacherId })
      .select("_id name inviteCode email instrument grade parent")
      .sort({ createdAt: 1 })
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

    if (!stu) return res.status(404).json({ error: "Student not found" });

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

    if (!stu) return res.status(404).json({ error: "Student not found" });

    return res.status(200).json({ items: stu.progressItems });
  } catch (e) {
    next(e);
  }
}

export async function createStudent(req, res, next) {
  try {
    const teacherId = getTeacherId(req);
    const { name, email, instrument, grade, parent } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    // backend validation
    const inst = validateInstrument(instrument);
    if (!inst.ok) return res.status(400).json({ error: inst.message });

    const grd = validateGradeRequired(grade);
    if (!grd.ok) return res.status(400).json({ error: grd.message });

    const doc = await Student.create({
      name: String(name).trim(),
      email: email ? String(email).trim() : "",
      instrument: inst.value,
      grade: grd.value, // null or integer 1–8
      parent: parent || {},
      teacherId,
    });

    return res.status(201).json({ student: doc });
  } catch (e) {
    next(e);
  }
}
