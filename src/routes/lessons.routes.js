import express from "express";
import Lesson from "../models/Lesson.js";
import { requireAuth } from "../middleware/auth.js"; // JWT middleware
import { requireRole } from "../middleware/roles.js"; // e.g. teacher/admin

const router = express.Router();

// Create or update (upsert) a lesson
router.post(
  "/",
  requireAuth,
  requireRole("teacher", "admin"),
  async (req, res) => {
    try {
      const teacherId = req.userId || req.user?._id || req.user?.sub;
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

      if (Array.isArray(scales?.items)) {
        scales.items = scales.items.map((it) => ({
          ...it,
          ready: it.ready === true,
        }));
      }

      const doc = await Lesson.findOneAndUpdate(
        { teacherId, studentId, lessonDate },
        {
          teacherId,
          studentId,
          lessonDate,
          share: !!share,
          pieces,
          scales,
          sightReading,
          auralTraining,
          teacherNarrative,
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );

      return res.status(200).json(doc);
    } catch (e) {
      return res
        .status(500)
        .json({ message: e?.message || "Failed to save lesson" });
    }
  },
);

router.get(
  "/latest/:studentId",
  requireAuth,
  requireRole("teacher", "admin"),
  async (req, res) => {
    const teacherId = req.userId; // FIX
    const { studentId } = req.params;

    const doc = await Lesson.findOne({ teacherId, studentId })
      .sort({ lessonDate: -1 })
      .lean();
    res.json(doc || null);
  },
);

export default router;
