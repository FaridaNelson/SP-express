import { Router } from "express";
import { signup, login, me, logout } from "../controllers/auth.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

const r = Router();

r.get("/me", optionalAuth, me);
r.post("/signup", signup);
r.post("/login", login);
r.post("/logout", requireAuth, logout);

export default r;
