import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import {
  createStudent,
  getStudentById,
  updateStudent,
  archiveStudent,
} from "../controllers/student.controller.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("teacher", "admin"));

router.post("/", createStudent);
router.get("/:studentId", validateObjectId("studentId"), getStudentById);
router.patch("/:studentId", validateObjectId("studentId"), updateStudent);
router.delete("/:studentId", validateObjectId("studentId"), archiveStudent);

export default router;
