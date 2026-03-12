import { Router } from "express";
import { signup, login, me, logout } from "../controllers/auth.controller.js";
import { optionalAuth } from "../middleware/auth.js";

const r = Router();

r.post("/signup", signup);
r.post("/login", login);
r.get("/me", optionalAuth, me);
r.post("/logout", logout);

export default r;
