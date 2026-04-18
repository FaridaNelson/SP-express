import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import {
  getParentStudents,
  getParentStudentProgress,
  getParentStudentProgressHistory,
  getParentStudentCycles,
  linkStudentByInviteCode,
} from "../controllers/parent.controller.js";
import { upsertPracticeLog } from "../controllers/practiceLog.controller.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("parent", "admin"));

router.post("/link-student", linkStudentByInviteCode);
router.get("/students", getParentStudents);
router.get("/students/:id/cycles", validateObjectId("id"), getParentStudentCycles);
router.get("/students/:id/progress", validateObjectId("id"), getParentStudentProgress);
router.get("/students/:id/progress/history", validateObjectId("id"), getParentStudentProgressHistory);
router.post("/students/:id/practice-log", validateObjectId("id"), upsertPracticeLog);

export default router;
