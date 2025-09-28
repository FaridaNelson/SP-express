import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const COOKIE = "sp_jwt";
const DAYS = Number(process.env.JWT_DAYS || 7);
const SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function setSessionCookie(res, user) {
  const token = jwt.sign(
    { sub: user._id.toString(), name: user.name },
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
    const { name, email, password } = req.body || {};
    if (!name || !email || !password)
      return res.status(400).json({ error: "Missing fields" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash });

    setSessionCookie(res, user);
    res
      .status(201)
      .json({ user: { _id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    if (err?.code === 11000)
      return res.status(409).json({ error: "Email already registered" });
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "Missing fields" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    setSessionCookie(res, user);
    res.json({ user: { _id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  const u = req.user || null;
  if (!u) return res.json({ user: null });
  res.json({ user: { _id: u._id, name: u.name, email: u.email } });
}

export async function logout(_req, res) {
  const prod = process.env.NODE_ENV === "production";
  res.clearCookie(COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: prod,
  });
  res.json({ ok: true });
}
