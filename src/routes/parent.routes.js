import { Router } from "express";
import Student from "../models/Student.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

const r = Router();

const DEFAULT_ITEMS = [
  { id: "scales", label: "Scales", weight: 15, score: 0 },
  { id: "pieceA", label: "Piece A", weight: 20, score: 0 },
  { id: "pieceB", label: "Piece B", weight: 20, score: 0 },
  { id: "pieceC", label: "Piece C", weight: 20, score: 0 },
  { id: "sightReading", label: "Sight Reading", weight: 13, score: 0 },
  { id: "auralTraining", label: "AuralTraining", weight: 12, score: 0 },
];

// GET progress for parent's linked student
r.get(
  "/students/:id/progress",
  requireAuth,
  requireRole("parent", "admin"),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      // parent can only access their own linked student (unless admin)
      if (!req.user.roles?.includes("admin")) {
        if (!req.user.studentId || String(req.user.studentId) !== String(id)) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }
      const stu = await Student.findById(id).select("_id progressItems").lean();
      if (!stu) return res.status(404).json({ error: "Student not found" });
      res.json({
        items: stu.progressItems?.length ? stu.progressItems : DEFAULT_ITEMS,
      });
    } catch (e) {
      next(e);
    }
  }
);

export default r;
