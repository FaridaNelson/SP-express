import Student from "../models/Student.js";
import ExamPreparationCycle from "../models/ExamPreparationCycle.js";
import ScoreEntry from "../models/ScoreEntry.js";
import AuditLog from "../models/AuditLog.js";
import { DEFAULT_PROGRESS_ITEMS } from "../constants/progressItems.js";

function getParentId(req) {
  return req.user._id;
}

function isAdmin(req) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes("admin");
}

async function logAdminParentAccess(req, action, studentId) {
  await AuditLog.create({
    actorUserId: req.user._id,
    actorRoles: Array.isArray(req.user.roles) ? req.user.roles : [],
    action,
    targetType: "Student",
    targetId: studentId || req.user._id,
    studentId: studentId || null,
    metadata: { adminBypass: true },
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || "",
  });
}

export async function getParentStudents(req, res, next) {
  try {
    const parentId = getParentId(req);
    const adminBypass = isAdmin(req);

    const query = adminBypass ? {} : { parentIds: parentId };

    const students = await Student.find(query)
      .select(
        "_id firstName lastName name email instrument grade teacherId parent parentIds studentUserId activeExamCycleId",
      )
      .populate(
        "activeExamCycleId",
        "examType status startDate endDate instrument",
      )
      .sort({ createdAt: 1 })
      .lean();

    if (adminBypass) {
      await logAdminParentAccess(req, "ADMIN_LIST_ALL_STUDENTS", null);
    }

    return res.json({ students });
  } catch (e) {
    next(e);
  }
}

export async function getParentStudentProgress(req, res, next) {
  try {
    const { id } = req.params;
    const adminBypass = isAdmin(req);

    // parentId always comes from the server-side JWT — never from req.body/req.query
    const query = adminBypass
      ? { _id: id }
      : { _id: id, parentIds: getParentId(req) };

    const student = await Student.findOne(query)
      .select("_id progressItems activeExamCycleId")
      .populate("activeExamCycleId", "progressSummary examType")
      .lean();

    // Returns 404 (not 403) for unlinked students — consistent with BOLA pattern
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    if (adminBypass) {
      await logAdminParentAccess(req, "ADMIN_VIEW_STUDENT_PROGRESS", id);
    }

    const ELEMENT_META = {
      pieceA: { label: "Piece A", weight: 20 },
      pieceB: { label: "Piece B", weight: 20 },
      pieceC: { label: "Piece C", weight: 20 },
      pieceD: { label: "Piece D", weight: 20 },
      scales: { label: "Scales", weight: 14 },
      sightReading: { label: "Sight-Reading", weight: 14 },
      auralTraining: { label: "Aural", weight: 12 },
    };

    const cycle = student.activeExamCycleId;

    if (cycle?.progressSummary?.latestScores) {
      const { latestScores, requiredElements } = cycle.progressSummary;

      const items = (requiredElements ?? Object.keys(latestScores)).map(
        (elementId) => ({
          id: elementId,
          label: ELEMENT_META[elementId]?.label ?? elementId,
          weight: ELEMENT_META[elementId]?.weight ?? 0,
          score: latestScores[elementId] ?? 0,
        }),
      );

      return res.json({ items });
    }

    // Fallback: no active cycle or progressSummary not yet computed
    return res.json({
      items: student.progressItems?.length
        ? student.progressItems
        : DEFAULT_PROGRESS_ITEMS,
    });
  } catch (e) {
    next(e);
  }
}

export async function getParentStudentCycles(req, res, next) {
  try {
    const { id } = req.params;
    const adminBypass = isAdmin(req);

    const student = await Student.findById(id).select("_id parentIds").lean();

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    if (
      !adminBypass &&
      !student.parentIds?.some((pid) => pid.toString() === getParentId(req).toString())
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (adminBypass) {
      await logAdminParentAccess(req, "ADMIN_VIEW_STUDENT_CYCLES", id);
    }

    const cycles = await ExamPreparationCycle.find({ studentId: id })
      .select(
        "_id instrument examGrade examType status examTaken createdAt updatedAt",
      )
      .sort({ endDate: -1 })
      .lean();

    return res.json({ cycles });
  } catch (e) {
    next(e);
  }
}

export async function linkStudentByInviteCode(req, res, next) {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode || typeof inviteCode !== "string") {
      return res.status(400).json({ error: "inviteCode is required" });
    }

    const student = await Student.findOne({
      inviteCode: inviteCode.toUpperCase(),
    }).lean();

    if (!student) {
      return res.status(404).json({ error: "Invalid invite code" });
    }

    const parentId = getParentId(req);

    if (student.parentIds?.some((pid) => pid.toString() === parentId.toString())) {
      return res.status(409).json({ error: "Already linked to this student" });
    }

    await Student.updateOne(
      { _id: student._id },
      { $addToSet: { parentIds: parentId } },
    );

    return res.json({
      student: {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        name: student.name,
        grade: student.grade,
        instrument: student.instrument,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function getParentStudentProgressHistory(req, res, next) {
  try {
    const { id } = req.params;
    const adminBypass = isAdmin(req);

    const query = adminBypass
      ? { _id: id }
      : { _id: id, parentIds: getParentId(req) };

    const student = await Student.findOne(query)
      .select("_id activeExamCycleId")
      .populate("activeExamCycleId", "examType instrument")
      .lean();

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    if (adminBypass) {
      await logAdminParentAccess(
        req,
        "ADMIN_VIEW_STUDENT_PROGRESS_HISTORY",
        id,
      );
    }

    const cycle = student.activeExamCycleId;

    if (!cycle) {
      return res.json({ history: [] });
    }

    // Weights mirror the frontend ELEMENT_META
    const WEIGHTS = {
      pieceA: 20,
      pieceB: 20,
      pieceC: 20,
      pieceD: 20,
      scales: 14,
      sightReading: 14,
      auralTraining: 12,
    };

    const requiredElements =
      cycle.examType === "Performance"
        ? ["pieceA", "pieceB", "pieceC", "pieceD"]
        : [
            "pieceA",
            "pieceB",
            "pieceC",
            "scales",
            "sightReading",
            "auralTraining",
          ];

    const totalWeight = requiredElements.reduce(
      (sum, id) => sum + (WEIGHTS[id] ?? 0),
      0,
    );

    // Fetch all score entries for this cycle, sorted oldest → newest
    const entries = await ScoreEntry.find({
      studentId: student._id,
      examPreparationCycleId: cycle._id,
      archivedAt: null,
      elementId: { $in: requiredElements },
    })
      .sort({ lessonDate: 1, createdAt: 1 })
      .select("elementId score lessonDate")
      .lean();

    if (!entries.length) {
      return res.json({ history: [] });
    }

    // Group entries by lessonDate (YYYY-MM-DD key)
    const byDate = new Map();
    for (const entry of entries) {
      const key = entry.lessonDate
        ? new Date(entry.lessonDate).toISOString().slice(0, 10)
        : "unknown";
      if (!byDate.has(key))
        byDate.set(key, { date: entry.lessonDate, scores: {} });
      // Keep only the latest entry per element per lesson
      byDate.get(key).scores[entry.elementId] = entry.score;
    }

    // Build cumulative snapshot: carry forward scores from previous lessons
    const dates = [...byDate.keys()].sort();
    const running = {}; // latest known score per element
    const history = [];

    dates.forEach((key, index) => {
      const { date, scores } = byDate.get(key);

      // Merge this lesson's scores into running state
      Object.assign(running, scores);

      // Compute weighted readiness with all scores seen so far
      const weightedSum = requiredElements.reduce((sum, elId) => {
        return sum + (running[elId] ?? 0) * (WEIGHTS[elId] ?? 0);
      }, 0);

      const readiness =
        totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

      const d = date ? new Date(date) : new Date(key);
      const lessonLabel = `L${index + 1}`;
      const dateLabel = d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });

      history.push({ score: readiness, lessonLabel, dateLabel });
    });

    return res.json({ history });
  } catch (e) {
    next(e);
  }
}
