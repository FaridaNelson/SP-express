import express from "express";
import {
  createCycle,
  getActiveCycleForStudent,
  updateCycleStatus,
  archiveCycle,
} from "../controllers/examPreparationCycle.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.post("/", createCycle);
router.get("/student/:studentId/active", getActiveCycleForStudent);
router.patch("/:cycleId/status", updateCycleStatus);
router.patch("/:cycleId/archive", archiveCycle);

export default router;
