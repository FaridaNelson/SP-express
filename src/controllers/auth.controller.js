import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Student from "../models/Student.js";

const COOKIE = "sp_jwt";
const DAYS = Number(process.env.JWT_DAYS || 7);
const SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

const ALLOWED_ROLES = ["admin", "teacher", "student", "parent"];

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function setSessionCookie(res, user) {
  const token = jwt.sign(
    {
      sub: user._id.toString(),
      name: user.name,
      email: user.email,
      roles: Array.isArray(user.roles) ? user.roles : [],
    },
    SECRET,
    { expiresIn: `${DAYS}d` },
  );

  const prod = process.env.NODE_ENV === "production";

  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: prod ? "none" : "lax",
    secure: prod,
    domain: prod ? ".studiopulse.co" : undefined,
    maxAge: DAYS * 24 * 60 * 60 * 1000,
  });
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || "").trim());
}

async function resolveStudentFromInviteOrId(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return null;

  if (isObjectId(raw)) {
    return Student.findById(raw);
  }

  return Student.findOne({ inviteCode: raw.toUpperCase() });
}

export async function signup(req, res, next) {
  try {
    const { name, email, password, role, roles, studentId, inviteCode } =
      req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required" });
    }

    const normalizedEmail = normalizeEmail(email);

    const requestedRoles =
      Array.isArray(roles) && roles.length > 0
        ? roles
        : role
          ? [role]
          : ["student"];

    const normalizedRoles = [
      ...new Set(requestedRoles.map((r) => String(r).trim())),
    ];

    const invalidRole = normalizedRoles.find((r) => !ALLOWED_ROLES.includes(r));
    if (invalidRole) {
      return res.status(400).json({ error: `Invalid role: ${invalidRole}` });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    let linkedStudent = null;

    // Preserve invite-code / join-code logic for parent signup
    if (normalizedRoles.includes("parent")) {
      const linkValue = inviteCode || studentId;

      if (!linkValue) {
        return res.status(400).json({
          error: "Student ID or invite code is required for parent signup",
        });
      }

      linkedStudent = await resolveStudentFromInviteOrId(linkValue);

      if (!linkedStudent) {
        return res.status(400).json({
          error: "Student not found. Check the student ID or invite code.",
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      roles: normalizedRoles,
    });

    // Attach parent user to the student after successful parent signup
    if (normalizedRoles.includes("parent") && linkedStudent) {
      await Student.updateOne(
        { _id: linkedStudent._id },
        { $addToSet: { parentIds: user._id } },
      );
    }

    // Optional: if later you want student invite-code signup, you could attach
    // studentUserId here for users with role "student".

    setSessionCookie(res, user);

    return res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
      linkedStudentId: linkedStudent?._id || null,
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
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+passwordHash",
    );
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    setSessionCookie(res, user);

    return res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res, next) {
  try {
    if (!req.user) {
      return res.json({ user: null });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.json({ user: null });
    }

    return res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req, res) {
  const prod = process.env.NODE_ENV === "production";

  res.clearCookie(COOKIE, {
    httpOnly: true,
    sameSite: prod ? "none" : "lax",
    secure: prod,
    domain: prod ? ".studiopulse.co" : undefined,
  });

  return res.json({ ok: true });
}
