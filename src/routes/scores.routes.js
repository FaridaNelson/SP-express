import express from "express";
import ScoreEntry from "../models/ScoreEntry.js";
import Student from "../models/Student.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Create a score entry
router.post(
  "/teacher/students/:studentId/scores",
  requireAuth,
  async (req, res, next) => {
    try {
      const teacherId = (req.user?.sub || req.user?._id || "").toString();
      const { studentId } = req.params;

      const { entries } = req.body || {};
      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ message: "entries[] required" });
      }

      // 1) make sure student belongs to this teacher
      const student = await Student.findOne({
        _id: studentId,
        teacherId,
      }).select("_id");
      if (!student)
        return res.status(404).json({ message: "Student not found" });

      // 2) create log entry
      const docs = entries.map((e) => ({
        teacherId,
        studentId,
        itemId: e.itemId ?? e.elementId,
        itemLabel: e.itemLabel ?? e.elementLabel,
        value: e.value ?? e.score,
        note: e.note ?? e.notes ?? undefined,
        tempoCurrent: e.tempoCurrent,
        tempoGoal: e.tempoGoal,
        dynamics: e.dynamics,
        articulation: e.articulation,
        lessonDate: e.lessonDate,
      }));

      const created = await ScoreEntry.insertMany(docs);
      // 3) OPTIONAL: also update the Student.progressItems score “current value”
      // If your UI expects progressItems.score to change:
      for (const d of docs) {
        if (!d.itemId || d.value == null) continue;
        await Student.updateOne(
          { _id: studentId, teacherId, "progressItems.id": d.itemId },
          { $set: { "progressItems.$.score": d.value } },
        );
      }

      res.status(201).json({ entries: created });
    } catch (err) {
      next(err);
    }
  },
);

// Get score history (paginated)
router.get(
  "/teacher/students/:studentId/scores",
  requireAuth,
  async (req, res, next) => {
    try {
      const teacherId = (req.user?.sub || req.user?._id || "").toString();
      const { studentId } = req.params;

      const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
      const page = Math.max(parseInt(req.query.page || "1", 10), 1);
      const skip = (page - 1) * limit;

      // Verify ownership
      const student = await Student.findOne({
        _id: studentId,
        teacherId,
      }).select("_id");
      if (!student)
        return res.status(404).json({ message: "Student not found" });

      const [items, total] = await Promise.all([
        ScoreEntry.find({ teacherId, studentId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ScoreEntry.countDocuments({ teacherId, studentId }),
      ]);

      res.json({
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
