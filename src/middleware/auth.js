import jwt from "jsonwebtoken";
import User from "../models/User.js";

const COOKIE = "sp_jwt";
const SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function getToken(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  if (typeof h === "string" && h.startsWith("Bearer ")) return h.slice(7);

  // Fallback to cookie
  if (req.cookies?.[COOKIE]) return req.cookies[COOKIE];

  return null;
}

function normalizeUserFromJwt(payload = {}) {
  const roles = Array.isArray(payload.roles)
    ? payload.roles
    : payload.role
    ? [payload.role]
    : [];

  return {
    // core identifiers
    sub: payload.sub,
    _id: payload.sub,

    // profile
    email: payload.email || null,
    name: payload.name || null,

    // roles (both forms supported)
    role: payload.role || roles[0] || null,
    roles,

    // scoping claims
    teacherId: payload.teacher_id ?? payload.teacherId ?? null,
    studentId: payload.student_id ?? payload.studentId ?? null,
    parentId: payload.parent_id ?? payload.parentId ?? null,

    ...payload, // safe if you don't put secrets in the token
  };
}

export function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Missing token" });

  try {
    const payload = jwt.verify(token, SECRET);
    req.user = normalizeUserFromJwt(payload);
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function optionalAuth(req, _res, next) {
  const token = getToken(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, SECRET);
    let userShape = normalizeUserFromJwt(payload);

    // Refresh basic fields/role from DB if user still exists
    const dbUser = await User.findById(userShape.sub)
      .select("_id name email role roles teacherId studentId parentId")
      .lean();

    if (dbUser) {
      // Prefer DB values (e.g., if role changed after token was issued)
      const roles = Array.isArray(dbUser.roles)
        ? dbUser.roles
        : dbUser.role
        ? [dbUser.role]
        : userShape.roles;

      userShape = {
        ...userShape,
        _id: dbUser._id?.toString() || userShape._id,
        name: dbUser.name ?? userShape.name,
        email: dbUser.email ?? userShape.email,
        role: roles[0] || null,
        roles,
        teacherId: dbUser.teacherId ?? userShape.teacherId,
        studentId: dbUser.studentId ?? userShape.studentId,
        parentId: dbUser.parentId ?? userShape.parentId,
      };
    }

    req.user = userShape;
  } catch {
    // Ignore bad/expired tokens; proceed unauthenticated
  }
  next();
}
