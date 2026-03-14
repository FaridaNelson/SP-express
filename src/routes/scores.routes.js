import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  createScoreEntries,
  getScoreHistory,
} from "../controllers/scores.controller.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("teacher", "admin"));

router.post("/teacher/students/:studentId/scores", createScoreEntries);
router.get("/teacher/students/:studentId/scores", getScoreHistory);

export default router;
