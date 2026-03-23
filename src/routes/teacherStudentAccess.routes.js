import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import {
  assignPrimaryTeacher,
  addTeacherAccess,
  revokeTeacherAccess,
  listTeacherAccessForStudent,
  listStudentsForTeacher,
} from "../controllers/teacherStudentAccess.controller.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("teacher", "admin"));

router.get("/teacher/:teacherId/students", validateObjectId("teacherId"), listStudentsForTeacher);
router.get("/student/:studentId", validateObjectId("studentId"), listTeacherAccessForStudent);

router.post("/student/:studentId/primary", validateObjectId("studentId"), assignPrimaryTeacher);
router.post("/student/:studentId/access", validateObjectId("studentId"), addTeacherAccess);
router.post("/student/:studentId/access/:accessId/revoke", validateObjectId("studentId", "accessId"), revokeTeacherAccess);

export default router;
