import jwt from "jsonwebtoken";
import User from "../models/User.js";

const COOKIE = "sp_jwt";
const SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function getToken(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  if (typeof h === "string" && h.startsWith("Bearer ")) {
    return h.slice(7);
  }

  if (req.cookies?.[COOKIE]) {
    return req.cookies[COOKIE];
  }

  return null;
}

function normalizeUserFromJwt(payload = {}) {
  const roles = Array.isArray(payload.roles)
    ? payload.roles
    : payload.role
      ? [payload.role]
      : [];

  return {
    sub: payload.sub,
    _id: payload.sub,
    email: payload.email || null,
    name: payload.name || null,
    role: payload.role || roles[0] || null,
    roles,
  };
}

export function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, SECRET);
    req.user = normalizeUserFromJwt(payload);
    req.userId = req.user.sub;
    req.roles = req.user.roles;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function optionalAuth(req, _res, next) {
  const token = getToken(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, SECRET);
    let userShape = normalizeUserFromJwt(payload);

    const dbUser = await User.findById(userShape.sub)
      .select("_id name email roles")
      .lean();

    if (dbUser) {
      const roles = Array.isArray(dbUser.roles) ? dbUser.roles : [];

      userShape = {
        ...userShape,
        _id: dbUser._id?.toString() || userShape._id,
        sub: dbUser._id?.toString() || userShape.sub,
        name: dbUser.name ?? userShape.name,
        email: dbUser.email ?? userShape.email,
        role: roles[0] || null,
        roles,
      };

      req.userId = userShape.sub || null;
      req.roles = userShape.roles || [];
    }

    req.user = userShape;
  } catch {
    // ignore invalid token and continue unauthenticated
  }

  next();
}
