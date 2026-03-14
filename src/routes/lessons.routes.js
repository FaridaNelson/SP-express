import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import {
  upsertLesson,
  getLatestLesson,
} from "../controllers/lessons.controller.js";

const router = Router();

router.use(requireAuth);
router.use(requireRole("teacher", "admin"));

router.post("/", upsertLesson);
router.get("/latest/:studentId", getLatestLesson);

export default router;
