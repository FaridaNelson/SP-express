import jwt from "jsonwebtoken";
import User from "../models/User.js";

const COOKIE = "sp_jwt";
const SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function getToken(req) {
  const authHeader =
    req.headers.authorization || req.headers.Authorization || "";

  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
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

  const userId = payload.sub ? String(payload.sub) : null;

  return {
    sub: userId,
    _id: userId,
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
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function optionalAuth(req, _res, next) {
  const token = getToken(req);

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, SECRET);
    let userShape = normalizeUserFromJwt(payload);

    const dbUser = await User.findById(userShape.sub)
      .select("_id firstName lastName name email roles")
      .lean();

    if (dbUser) {
      const roles = Array.isArray(dbUser.roles) ? dbUser.roles : [];

      userShape = {
        ...userShape,
        _id: dbUser._id?.toString() || userShape._id,
        sub: dbUser._id?.toString() || userShape.sub,
        firstName: dbUser.firstName || null,
        lastName: dbUser.lastName || null,
        name: dbUser.name ?? userShape.name,
        email: dbUser.email ?? userShape.email,
        role: roles[0] || null,
        roles,
      };
    }

    req.user = userShape;
  } catch {
    // Ignore invalid token and continue unauthenticated
  }

  next();
}
