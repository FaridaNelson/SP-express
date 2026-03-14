import ScoreEntry from "../models/ScoreEntry.js";
import { findTeacherStudentById } from "../utils/studentAccess.js";

export async function createScoreEntries(req, res, next) {
  try {
    const teacherId = req.user._id;
    const { studentId } = req.params;
    const { entries } = req.body || {};

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: "entries[] required" });
    }

    const student = await findTeacherStudentById(studentId, teacherId, "_id");
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const docs = entries.map((e) => {
      const lessonDate = e.lessonDate ?? e.date;
      const elementId = e.elementId ?? e.itemId;
      const elementLabel = e.elementLabel ?? e.itemLabel;
      const score = e.score ?? e.value;

      return {
        teacherId,
        studentId,
        lessonDate,
        elementId,
        elementLabel,
        score,
        tempoCurrent: e.tempoCurrent,
        tempoGoal: e.tempoGoal,
        dynamics: e.dynamics,
        articulation: e.articulation,
        pitchAccuracy: e.pitchAccuracy,
        rhythmAccuracy: e.rhythmAccuracy,
        adequateTempo: e.adequateTempo,
        confidentPresentation: e.confidentPresentation,
        singingInPitch: e.singingInPitch,
        musicalMemory: e.musicalMemory,
        musicalPerceptiveness: e.musicalPerceptiveness,
      };
    });

    for (const d of docs) {
      if (!d.lessonDate) {
        return res.status(400).json({ message: "lessonDate required" });
      }
      if (!d.elementId) {
        return res.status(400).json({ message: "elementId required" });
      }
    }

    const created = await ScoreEntry.insertMany(docs);

    return res.status(201).json({ items: created });
  } catch (err) {
    next(err);
  }
}

export async function getScoreHistory(req, res, next) {
  try {
    const teacherId = req.user._id;
    const { studentId } = req.params;

    const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const skip = (page - 1) * limit;

    const student = await findTeacherStudentById(studentId, teacherId, "_id");
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const [items, total] = await Promise.all([
      ScoreEntry.find({ teacherId, studentId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ScoreEntry.countDocuments({ teacherId, studentId }),
    ]);

    return res.json({
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
}
