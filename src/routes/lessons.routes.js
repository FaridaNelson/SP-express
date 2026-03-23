import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { validateObjectId } from "../middleware/validateObjectId.js";
import {
  upsertLesson,
  getLessonById,
  listLessonsForStudent,
  getLatestLessonForStudent,
  archiveLesson,
} from "../controllers/lesson.controller.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("teacher", "admin"));

router.put("/", upsertLesson);
router.get("/:lessonId", validateObjectId("lessonId"), getLessonById);
router.get("/student/:studentId", validateObjectId("studentId"), listLessonsForStudent);
router.get("/student/:studentId/latest", validateObjectId("studentId"), getLatestLessonForStudent);
router.delete("/:lessonId", validateObjectId("lessonId"), archiveLesson);

export default router;
