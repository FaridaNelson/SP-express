import express from "express";
import {
  getPracticeLog,
  upsertPracticeLog,
} from "../controllers/practiceLog.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/parent/students/:id/practice-log", requireAuth, getPracticeLog);

router.post(
  "/parent/students/:id/practice-log",
  requireAuth,
  upsertPracticeLog,
);

export default router;
