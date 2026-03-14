import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  getParentStudents,
  getParentStudentProgress,
} from "../controllers/parent.controller.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("parent", "admin"));

router.get("/students", getParentStudents);
router.get("/students/:id/progress", getParentStudentProgress);

export default router;
