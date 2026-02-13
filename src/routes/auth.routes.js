import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import mongoose from "mongoose";
import Student from "../models/Student.js";
import { signup, login, me, logout } from "../controllers/auth.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

const r = Router();

const SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const COOKIE = "sp_jwt";
const cookieOpts = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function signFor(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role:
        user.role || (Array.isArray(user.roles) ? user.roles[0] : undefined),
      roles: Array.isArray(user.roles)
        ? user.roles
        : user.role
          ? [user.role]
          : [],
      email: user.email,
      name: user.name,
    },
    SECRET,
    { expiresIn: "7d" },
  );
}

const isObjectId = (v) =>
  mongoose.Types.ObjectId.isValid(String(v || "").trim());

// POST /api/auth/signup
r.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password, role, studentId } = req.body || {};
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required" });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "User already exists" });

    let linkStudentId = null;
    if (role === "parent") {
      const raw = (studentId || "").trim();
      if (!raw) {
        return res
          .status(400)
          .json({ error: "Student ID or Join Code is required" });
      }
      let student = null;
      if (isObjectId(raw)) {
        student = await Student.findById(raw).select("_id");
      } else {
        // nomralize code to uppercase so teachers can share case-insensitively
        student = await Student.findOne({
          inviteCode: raw.toUpperCase(),
        }).select("_id");
      }
      if (!student) {
        return res
          .status(400)
          .json({ error: "Student not found. Check the ID/code." });
      }
      linkStudentId = student._id;
    }
    const roles = role ? [role] : ["student"];
    const user = new User({
      name,
      email,
      roles,
      studentId: linkStudentId, // only set for parents, null otherwise
    });

    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();

    const token = signFor(user);
    res.cookie(COOKIE, token, cookieOpts).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: user.roles, // full array
        studentId: user.studentId,
      },
    });
  } catch (e) {
    next(e);
  }
});

r.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const user = await User.findOne({ email }).select(
      "+passwordHash role roles name email studentId",
    );
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signFor(user);
    res.cookie(COOKIE, token, cookieOpts).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: user.roles,
        studentId: user.studentId,
      },
    });
  } catch (e) {
    next(e);
  }
});

r.get("/me", optionalAuth, async (req, res) => {
  if (!req.user?.sub) return res.json({ user: null });

  const user = await User.findById(req.user.sub)
    .select("_id name email role roles studentId")
    .lean();

  res.json({ user: user ?? null });
});

r.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE, { ...cookieOpts, maxAge: 0 });
  res.json({ ok: true });
});

export default r;
