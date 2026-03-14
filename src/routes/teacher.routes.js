import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

import {
  listStudents,
  createStudent,
  getProgress,
  setProgress,
} from "../controllers/teacherStudents.controller.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("teacher", "admin"));

router.get("/students", listStudents);
router.get("/students/:id/progress", getProgress);
router.post("/students/:id/progress", setProgress);
router.post("/students", createStudent);

export default router;
