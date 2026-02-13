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
      const teacherId = req.user.id;
      const { studentId } = req.params;
      const { itemId, itemLabel, value, note } = req.body;

      // 1) make sure student belongs to this teacher
      const student = await Student.findOne({ _id: studentId, teacherId });
      if (!student)
        return res.status(404).json({ message: "Student not found" });

      // 2) create log entry
      const entry = await ScoreEntry.create({
        teacherId,
        studentId,
        itemId,
        itemLabel,
        value,
        note,
      });

      // 3) OPTIONAL: also update the Student.progressItems score “current value”
      // If your UI expects progressItems.score to change:
      if (itemId) {
        await Student.updateOne(
          { _id: studentId, teacherId, "progressItems.id": itemId },
          { $set: { "progressItems.$.score": value } },
        );
      }

      res.status(201).json({ entry });
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
      const teacherId = req.user.id;
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
