import { Router } from "express";
import rateLimit from "express-rate-limit";
import { signup, login, me, logout } from "../controllers/auth.controller.js";
import { optionalAuth } from "../middleware/auth.js";

const authLimiter =
  process.env.NODE_ENV === "test"
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 15, // 15 attempts per window
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: "Too many attempts, please try again later" },
      });

const router = Router();

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.get("/me", optionalAuth, me);
router.post("/logout", logout);

export default router;
