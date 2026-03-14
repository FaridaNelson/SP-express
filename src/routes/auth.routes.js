import { Router } from "express";
import { signup, login, me, logout } from "../controllers/auth.controller.js";
import { optionalAuth } from "../middleware/auth.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", optionalAuth, me);
router.post("/logout", logout);

export default router;
