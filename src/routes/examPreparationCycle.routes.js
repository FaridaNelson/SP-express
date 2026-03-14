import { Router } from "express";
import {
  createCycle,
  getActiveCycleForStudent,
  updateCycleStatus,
  archiveCycle,
} from "../controllers/examPreparationCycle.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("teacher", "admin"));

router.post("/", createCycle);
router.get("/student/:studentId/active", getActiveCycleForStudent);
router.patch("/:cycleId/status", updateCycleStatus);
router.patch("/:cycleId/archive", archiveCycle);

export default router;
