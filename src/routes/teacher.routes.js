import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

import {
  listStudents,
  createStudent,
  getProgress,
  setProgress,
} from "../controllers/teacherStudents.controller.js";

const r = Router();

r.get("/students", requireAuth, requireRole("teacher", "admin"), listStudents);

r.get(
  "/students/:id/progress",
  requireAuth,
  requireRole("teacher", "admin"),
  getProgress,
);

r.post(
  "/students/:id/progress",
  requireAuth,
  requireRole("teacher", "admin"),
  setProgress,
);

r.post(
  "/students",
  requireAuth,
  requireRole("teacher", "admin"),
  createStudent,
);

export default r;
