import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getDailySlice } from "../controllers/soundslice.controller.js";

const r = Router();
r.get("/daily", requireAuth, getDailySlice);
export default r;
