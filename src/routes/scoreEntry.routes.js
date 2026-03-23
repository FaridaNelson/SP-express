import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { createScoreEntry } from "../controllers/scoreEntry.controller.js";

const router = express.Router();

router.use(requireAuth);
router.use(requireRole("teacher", "admin"));

router.post("/", createScoreEntry);

export default router;
