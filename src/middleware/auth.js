import jwt from "jsonwebtoken";
import User from "../models/User.js";

const COOKIE = "sp_jwt";
const SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const payload = jwt.verify(token, SECRET);
    const user = await User.findById(payload.sub).select("_id name email");
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) return next();
    const payload = jwt.verify(token, SECRET);
    const user = await User.findById(payload.sub).select("_id name email");
    if (user) req.user = user;
  } catch {
    // ignore bad/expired cookies
  }
  next();
}
