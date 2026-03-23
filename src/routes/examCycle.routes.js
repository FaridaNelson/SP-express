import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import {
  createExamCycle,
  updateExamCycle,
  setActiveExamCycle,
  listExamCyclesForStudent,
  getExamCycleById,
  completeExamCycle,
  withdrawExamCycle,
  archiveExamCycle,
} from "../controllers/examCycle.controller.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("teacher", "admin"));

router.post("/", createExamCycle);
router.patch("/:cycleId", validateObjectId("cycleId"), updateExamCycle);
router.get("/:cycleId", validateObjectId("cycleId"), getExamCycleById);
router.delete("/:cycleId", validateObjectId("cycleId"), archiveExamCycle);

router.get("/student/:studentId", validateObjectId("studentId"), listExamCyclesForStudent);
router.post("/student/:studentId/active/:cycleId", validateObjectId("studentId", "cycleId"), setActiveExamCycle);

router.post("/:cycleId/complete", validateObjectId("cycleId"), completeExamCycle);
router.post("/:cycleId/withdraw", validateObjectId("cycleId"), withdrawExamCycle);

export default router;
