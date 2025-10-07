import { Router } from "express";
import Student from "../models/Student.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

const r = Router();

r.get(
  "/students",
  requireAuth,
  requireRole("teacher", "admin"),
  async (req, res, next) => {
    try {
      const teacherId = req.user?.sub || req.user?._id;
      const list = await Student.find({ teacherId })
        .select("_id name inviteCode email instrument grade parent")
        .sort({ createdAt: 1 })
        .lean();

      return res.status(200).json({ students: list });
    } catch (e) {
      next(e);
    }
  }
);

const DEFAULT_ITEMS = [
  { id: "scales", label: "Scales", weight: 15, score: 0 },
  { id: "pieceA", label: "Piece A", weight: 20, score: 0 },
  { id: "pieceB", label: "Piece B", weight: 20, score: 0 },
  { id: "pieceC", label: "Piece C", weight: 20, score: 0 },
  { id: "sightReading", label: "Sight Reading", weight: 13, score: 0 },
  { id: "auralTraining", label: "Aural Training", weight: 12, score: 0 },
];

r.get(
  "/students/:id/progress",
  requireAuth,
  requireRole("teacher", "admin"),
  async (req, res, next) => {
    try {
      const teacherId = req.user?.sub || req.user?._id;
      const stu = await Student.findOne({ _id: req.params.id, teacherId })
        .select("_id progressItems")
        .lean();

      if (!stu) return res.status(404).json({ error: "Student not found" });

      res.json({
        items: stu.progressItems?.length ? stu.progressItems : DEFAULT_ITEMS,
      });
    } catch (e) {
      next(e);
    }
  }
);

r.post(
  "/students/:id/progress",
  requireAuth,
  requireRole("teacher", "admin"),
  async (req, res, next) => {
    try {
      const teacherId = req.user?.sub || req.user?._id;
      const { items } = req.body || {};
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "items[] required" });
      }

      const stu = await Student.findOneAndUpdate(
        { _id: req.params.id, teacherId },
        { $set: { progressItems: items } },
        { new: true, projection: "_id progressItems" }
      ).lean();

      if (!stu) return res.status(404).json({ error: "Student not found" });

      res.status(200).json({ items: stu.progressItems });
    } catch (e) {
      next(e);
    }
  }
);

export default r;
