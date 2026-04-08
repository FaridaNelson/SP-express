import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import {
  getParentStudents,
  getParentStudentProgress,
  getParentStudentProgressHistory,
} from "../controllers/parent.controller.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("parent", "admin"));

router.get("/students", getParentStudents);
router.get("/students/:id/progress", validateObjectId("id"), getParentStudentProgress);
router.get("/students/:id/progress/history", validateObjectId("id"), getParentStudentProgressHistory);

export default router;
