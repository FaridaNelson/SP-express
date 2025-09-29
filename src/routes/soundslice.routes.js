import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getDailySlice,
  listSlices,
  getSlice,
  createSlice,
} from "../controllers/soundslice.controller.js";

const r = Router();

r.get("/", requireAuth, listSlices);
r.get("/:id", requireAuth, getSlice);
r.post("/", requireAuth, createSlice);

r.get("/daily", requireAuth, getDailySlice);

export default r;
