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

router.put("/", requireRole("teacher", "admin"), upsertLesson);
router.get(
  "/student/:studentId/latest",
  requireRole("teacher", "admin"),
  validateObjectId("studentId"),
  getLatestLessonForStudent,
);
router.get(
  "/student/:studentId",
  requireRole("teacher", "admin", "parent"),
  validateObjectId("studentId"),
  listLessonsForStudent,
);
router.get(
  "/:lessonId",
  requireRole("teacher", "admin"),
  validateObjectId("lessonId"),
  getLessonById,
);
router.delete(
  "/:lessonId",
  requireRole("teacher", "admin"),
  validateObjectId("lessonId"),
  archiveLesson,
);

export default router;
