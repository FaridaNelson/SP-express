import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Resend } from "resend";
import User from "../models/User.js";
import Student from "../models/Student.js";

const COOKIE = "sp_jwt";
const DAYS = Number(process.env.JWT_DAYS || 7);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

const ALLOWED_ROLES = ["admin", "teacher", "student", "parent"];
const SELF_ASSIGNABLE_ROLES = ["teacher", "student", "parent"];

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function buildFullName(firstName, lastName) {
  return `${String(firstName || "").trim()} ${String(lastName || "").trim()}`.trim();
}

const ALLOWED_INSTRUMENTS = ["Piano", "Voice", "Guitar"];
const ALLOWED_YEARS_TEACHING = ["0-2", "3-5", "6-10", "10+"];

function normalizeInstrument(value) {
  const v = String(value || "").trim();
  return ALLOWED_INSTRUMENTS.includes(v) ? v : "";
}

function normalizeInstrumentsTaught(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((v) => String(v || "").trim()))].filter((v) =>
    ALLOWED_INSTRUMENTS.includes(v),
  );
}

function normalizeYearsTeaching(value) {
  const v = String(value || "").trim();
  return ALLOWED_YEARS_TEACHING.includes(v) ? v : "";
}

function setSessionCookie(res, user) {
  const token = jwt.sign(
    {
      sub: user._id.toString(),
      roles: Array.isArray(user.roles) ? user.roles : [],
    },
    getJwtSecret(),
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
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      roles,
      studentId,
      inviteCode,
      instrument,
      phone,
      studioName,
      instrumentsTaught,
      yearsTeaching,
    } = req.body || {};
    const trimmedFirstName = String(firstName || "").trim();
    const trimmedLastName = String(lastName || "").trim();
    const normalizedPhone = String(phone || "").trim();

    if (!trimmedFirstName || !trimmedLastName || !email || !password) {
      return res.status(400).json({
        error: "First name, last name, email, and password are required",
      });
    }

    if (String(password || "").length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters",
      });
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

    const invalidRole = normalizedRoles.find(
      (r) => !SELF_ASSIGNABLE_ROLES.includes(r),
    );
    if (invalidRole) {
      return res.status(400).json({ error: `Invalid role: ${invalidRole}` });
    }

    const isTeacher = normalizedRoles.includes("teacher");
    const isStudent = normalizedRoles.includes("student");
    const isParent = normalizedRoles.includes("parent");

    const normalizedInstrument = normalizeInstrument(instrument);
    const normalizedStudioName = String(studioName || "").trim();
    const normalizedInstrumentsTaught =
      normalizeInstrumentsTaught(instrumentsTaught);
    const normalizedYearsTeaching = normalizeYearsTeaching(yearsTeaching);

    if (isStudent && !isParent && !normalizedInstrument) {
      return res.status(400).json({
        error: "Instrument is required for student signup",
      });
    }

    if (isTeacher) {
      if (!normalizedStudioName) {
        return res.status(400).json({
          error: "Studio / organization is required for teacher signup",
        });
      }

      if (normalizedInstrumentsTaught.length === 0) {
        return res.status(400).json({
          error: "Please select at least one instrument you teach",
        });
      }

      if (!normalizedYearsTeaching) {
        return res.status(400).json({
          error: "Years teaching is required for teacher signup",
        });
      }
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    let linkedStudent = null;

    if (isParent) {
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
    const fullName = buildFullName(trimmedFirstName, trimmedLastName);

    const user = await User.create({
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      name: fullName,
      email: normalizedEmail,
      passwordHash,
      roles: normalizedRoles,
      phone: normalizedPhone,
      instrument: isStudent && !isParent ? normalizedInstrument : "",
      studioName: isTeacher ? normalizedStudioName : "",
      instrumentsTaught: isTeacher ? normalizedInstrumentsTaught : [],
      yearsTeaching: isTeacher ? normalizedYearsTeaching : "",
    });
    if (isParent && linkedStudent) {
      await Student.updateOne(
        { _id: linkedStudent._id },
        { $addToSet: { parentIds: user._id } },
      );
    }

    setSessionCookie(res, user);

    return res.status(201).json({
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        email: user.email,
        roles: user.roles,
        instrument: user.instrument,
        phone: user.phone,
        studioName: user.studioName,
        instrumentsTaught: user.instrumentsTaught,
        yearsTeaching: user.yearsTeaching,
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
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+passwordHash",
    );
    if (!user) {
      return res
        .status(401)
        .json({
          error:
            "Please check your email and try again, or Sign Up to create an account.",
        });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res
        .status(401)
        .json({
          error:
            "Please check your email and try again, or Sign Up to create an account.",
        });
    }

    setSessionCookie(res, user);

    return res.json({
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        email: user.email,
        roles: user.roles,
        phone: user.phone,
        instrument: user.instrument,
        studioName: user.studioName,
        instrumentsTaught: user.instrumentsTaught,
        yearsTeaching: user.yearsTeaching,
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
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        email: user.email,
        roles: user.roles,
        phone: user.phone,
        instrument: user.instrument,
        studioName: user.studioName,
        instrumentsTaught: user.instrumentsTaught,
        yearsTeaching: user.yearsTeaching,
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

async function sendResetEmail(user, rawToken) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

  if (!process.env.RESEND_API_KEY) return;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "StudioPulse <noreply@studiopulse.co>",
      to: user.email,
      subject: "Reset your StudioPulse password",
      html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Reset your StudioPulse password</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF7F2;font-family:'DM Sans',Arial,sans-serif;color:#1C1A17;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F2;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <h1 style="margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;color:#1C1A17;">StudioPulse</h1>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:8px;padding:40px 32px;">
              <h2 style="margin:0 0 16px;font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:600;color:#1C1A17;">Reset your password</h2>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3D3A34;">We received a request to reset the password for your StudioPulse account. Click the button below to choose a new password.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="border-radius:6px;background-color:#C9A84C;">
                    <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'DM Sans',Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Reset password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#3D3A34;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;text-align:center;font-size:12px;color:#3D3A34;">
              &copy; ${new Date().getFullYear()} StudioPulse
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text: `Reset your StudioPulse password\n\nWe received a request to reset the password for your StudioPulse account.\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.\n\n© ${new Date().getFullYear()} StudioPulse`,
    });
  } catch (err) {
    // Email failure must not affect the 200 response
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.json({ message: "ok" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      await sendResetEmail(user, rawToken);
    }

    return res.json({ message: "ok" });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(String(token))
      .digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    return res.json({ message: "Password updated" });
  } catch (err) {
    next(err);
  }
}
