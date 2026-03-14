import Lesson from "../models/Lesson.js";
import { findTeacherStudentById } from "../utils/studentAccess.js";

export async function upsertLesson(req, res, next) {
  try {
    const teacherId = req.user._id;
    const {
      lessonDate,
      studentId,
      share = false,
      pieces = [],
      scales = { percent: 0, items: [] },
      sightReading = null,
      auralTraining = null,
      teacherNarrative = null,
    } = req.body || {};

    if (!lessonDate || !studentId) {
      return res
        .status(400)
        .json({ message: "lessonDate and studentId are required" });
    }

    const student = await findTeacherStudentById(studentId, teacherId, "_id");
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const normalizedScales = {
      ...scales,
      items: Array.isArray(scales?.items)
        ? scales.items.map((it) => ({
            ...it,
            ready: it.ready === true,
          }))
        : [],
    };

    const doc = await Lesson.findOneAndUpdate(
      { teacherId, studentId, lessonDate },
      {
        teacherId,
        studentId,
        lessonDate,
        share: !!share,
        pieces,
        scales: normalizedScales,
        sightReading,
        auralTraining,
        teacherNarrative,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return res.status(200).json(doc);
  } catch (e) {
    next(e);
  }
}

export async function getLatestLesson(req, res, next) {
  try {
    const teacherId = req.user._id;
    const { studentId } = req.params;

    const student = await findTeacherStudentById(studentId, teacherId, "_id");
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const doc = await Lesson.findOne({ teacherId, studentId })
      .sort({ lessonDate: -1 })
      .lean();

    return res.json(doc || null);
  } catch (e) {
    next(e);
  }
}
