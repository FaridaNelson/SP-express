import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const COOKIE = "sp_jwt";
const DAYS = Number(process.env.JWT_DAYS || 7);
const SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function setSessionCookie(res, user) {
  const token = jwt.sign(
    { sub: user._id.toString(), name: user.name, role: user.role },
    SECRET,
    { expiresIn: `${DAYS}d` }
  );
  const prod = process.env.NODE_ENV === "production";
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: prod,
    maxAge: DAYS * 24 * 60 * 60 * 1000,
  });
}

export async function signup(req, res, next) {
  try {
    const { name, email, password, role, studentId } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }
    if (role && !["student", "teacher", "parent"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const doc = await User.create({
      name,
      email,
      passwordHash,
      role: role || "student",
      studentId: role === "parent" ? studentId || null : null,
    });

    setSessionCookie(res, doc);
    return res.status(201).json({
      user: {
        _id: doc._id,
        name: doc.name,
        email: doc.email,
        role: doc.role,
        studentId: doc.studentId ?? null,
      },
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Email already registered" });
    }
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    setSessionCookie(res, user);
    return res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        studentId: user.studentId ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  if (!req.user) return res.json({ user: null });

  const user = await User.findById(req.user._id);
  if (!user) return res.json({ user: null });

  return res.json({
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId ?? null,
    },
  });
}

export async function logout(_req, res) {
  const prod = process.env.NODE_ENV === "production";
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: "lax", secure: prod });
  res.json({ ok: true });
}
