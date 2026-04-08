import Student from "../models/Student.js";
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
      .populate("activeExamCycleId", "examType status startDate endDate instrument")
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
      pieceA:        { label: "Piece 1",        weight: 20 },
      pieceB:        { label: "Piece 2",        weight: 20 },
      pieceC:        { label: "Piece 3",        weight: 20 },
      pieceD:        { label: "Piece 4",        weight: 20 },
      scales:        { label: "Scales",         weight: 14 },
      sightReading:  { label: "Sight-Reading",  weight: 14 },
      auralTraining: { label: "Aural",          weight: 12 },
    };

    const cycle = student.activeExamCycleId;

    if (cycle?.progressSummary?.latestScores) {
      const { latestScores, requiredElements } = cycle.progressSummary;

      const items = (requiredElements ?? Object.keys(latestScores)).map(
        (elementId) => ({
          id:     elementId,
          label:  ELEMENT_META[elementId]?.label  ?? elementId,
          weight: ELEMENT_META[elementId]?.weight ?? 0,
          score:  latestScores[elementId]         ?? 0,
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
