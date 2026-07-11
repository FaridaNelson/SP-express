import express from "express";
import {
  appendMyGameProgressSession,
  getMyGameProgress,
} from "../controllers/gameProgress.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("student"));

router.get("/me/:appId", getMyGameProgress);
router.post("/me/:appId/session", appendMyGameProgressSession);

export default router;
