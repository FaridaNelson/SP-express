import mongoose from "mongoose";
import GameProgress from "../models/GameProgress.js";
import Student from "../models/Student.js";
import { validateEnum } from "../utils/validate.js";

const VALID_APP_IDS = ["note-detective"];
const VALID_SESSION_MODES = ["practice", "timed"];
const VALID_SESSION_END_REASONS = [
  "student",
  "timer",
  "pagehide",
];

function validateAppId(appId) {
  return validateEnum(appId, VALID_APP_IDS, "appId");
}

async function getLinkedStudent(userId) {
  return Student.findOne({
    studentUserId: userId,
    status: { $ne: "archived" },
  })
    .select("_id")
    .lean();
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function normalizeNonNegativeNumber(value, fieldName) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw badRequest(`${fieldName} must be a non-negative number`);
  }
  return numberValue;
}

function normalizeNonNegativeInteger(value, fieldName) {
  const numberValue = normalizeNonNegativeNumber(value, fieldName);
  if (!Number.isInteger(numberValue)) {
    throw badRequest(`${fieldName} must be a non-negative integer`);
  }
  return numberValue;
}

function normalizeOptionalObjectId(value, fieldName) {
  if (value === null) return null;
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw badRequest(`${fieldName} must be a valid ObjectId`);
  }
  return new mongoose.Types.ObjectId(value);
}

function normalizeSession(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("session is required");
  }

  const session = {};
  let hasClientSuppliedProgress = false;

  for (const field of ["score", "duration", "timerMinutes"]) {
    if (value[field] === undefined) continue;
    session[field] = normalizeNonNegativeNumber(value[field], field);
    hasClientSuppliedProgress = true;
  }

  for (const field of ["correct", "incorrect"]) {
    if (value[field] === undefined) continue;
    session[field] = normalizeNonNegativeInteger(value[field], field);
    hasClientSuppliedProgress = true;
  }

  if (value.mode !== undefined) {
    session.mode = validateEnum(value.mode, VALID_SESSION_MODES, "mode");
    hasClientSuppliedProgress = true;
  }

  if (value.endedBy !== undefined) {
    session.endedBy = validateEnum(
      value.endedBy,
      VALID_SESSION_END_REASONS,
      "endedBy",
    );
    hasClientSuppliedProgress = true;
  }

  if (value.completedAt !== undefined) {
    const completedAt = new Date(value.completedAt);
    if (Number.isNaN(completedAt.getTime())) {
      throw badRequest("completedAt must be a valid date");
    }
    session.completedAt = completedAt;
  } else {
    session.completedAt = new Date();
  }

  // MongoDB stores completed session summaries, not empty heartbeat records.
  // A session with only completedAt is rejected even when completedAt is server-generated.
  if (!hasClientSuppliedProgress) {
    throw badRequest("session must include progress fields");
  }

  return session;
}

function addCumulativeStatsSetPaths(setPayload, value) {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("cumulativeStats must be an object");
  }

  for (const [key, stat] of Object.entries(value)) {
    if (!key || key.startsWith("$") || key.includes(".")) {
      throw badRequest("cumulativeStats keys cannot begin with $ or contain .");
    }

    if (!stat || typeof stat !== "object" || Array.isArray(stat)) {
      throw badRequest("cumulativeStats entries must be objects");
    }

    if (stat.seen !== undefined) {
      setPayload[`cumulativeStats.${key}.seen`] = normalizeNonNegativeInteger(
        stat.seen,
        "cumulativeStats.seen",
      );
    }

    if (stat.wrong !== undefined) {
      setPayload[`cumulativeStats.${key}.wrong`] = normalizeNonNegativeInteger(
        stat.wrong,
        "cumulativeStats.wrong",
      );
    }
  }
}

function buildSetPayload(body = {}) {
  const setPayload = {};

  if (
    body.cycleContext &&
    typeof body.cycleContext === "object" &&
    !Array.isArray(body.cycleContext)
  ) {
    if (body.cycleContext.cycleType !== undefined) {
      setPayload["cycleContext.cycleType"] = validateEnum(
        body.cycleContext.cycleType,
        ["exam", "custom", "none"],
        "cycleContext.cycleType",
      );
    }

    if (body.cycleContext.examCycleId !== undefined) {
      setPayload["cycleContext.examCycleId"] = normalizeOptionalObjectId(
        body.cycleContext.examCycleId,
        "cycleContext.examCycleId",
      );
    }

    if (body.cycleContext.learningCycleId !== undefined) {
      setPayload["cycleContext.learningCycleId"] = normalizeOptionalObjectId(
        body.cycleContext.learningCycleId,
        "cycleContext.learningCycleId",
      );
    }
  } else if (body.cycleContext !== undefined) {
    throw badRequest("cycleContext must be an object");
  }

  if (body.moduleId !== undefined) {
    if (typeof body.moduleId !== "string") {
      throw badRequest("moduleId must be a string");
    }
    setPayload.moduleId = body.moduleId.trim();
  }

  if (body.unitId !== undefined) {
    if (typeof body.unitId !== "string") {
      throw badRequest("unitId must be a string");
    }
    setPayload.unitId = body.unitId.trim();
  }

  addCumulativeStatsSetPaths(setPayload, body.cumulativeStats);

  return setPayload;
}

export async function getMyGameProgress(req, res, next) {
  try {
    const appId = validateAppId(req.params.appId);
    const student = await getLinkedStudent(req.user._id);

    if (!student) {
      return res.status(404).json({ error: "Linked student not found" });
    }

    const progress = await GameProgress.findOne({
      studentId: student._id,
      appId,
    }).lean();

    return res.json({ gameProgress: progress });
  } catch (err) {
    next(err);
  }
}

export async function appendMyGameProgressSession(req, res, next) {
  try {
    const appId = validateAppId(req.params.appId);
    const student = await getLinkedStudent(req.user._id);

    if (!student) {
      return res.status(404).json({ error: "Linked student not found" });
    }

    const session = normalizeSession(req.body?.session);
    const setPayload = buildSetPayload(req.body);

    const progress = await GameProgress.findOneAndUpdate(
      {
        studentId: student._id,
        appId,
      },
      {
        ...(Object.keys(setPayload).length > 0 ? { $set: setPayload } : {}),
        $push: { sessions: session },
        $setOnInsert: {
          studentId: student._id,
          appId,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(201).json({ gameProgress: progress });
  } catch (err) {
    next(err);
  }
}
