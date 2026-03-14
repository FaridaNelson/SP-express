import Student from "../models/Student.js";
import { DEFAULT_PROGRESS_ITEMS } from "../constants/progressItems.js";

function getParentId(req) {
  return req.user._id;
}

function isAdmin(req) {
  return Array.isArray(req.user?.roles) && req.user.roles.includes("admin");
}

export async function getParentStudents(req, res, next) {
  try {
    const parentId = getParentId(req);

    const query = isAdmin(req) ? {} : { parentIds: parentId };

    const students = await Student.find(query)
      .select(
        "_id firstName lastName name email instrument grade teacherId parent parentIds studentUserId activeExamCycleId",
      )
      .populate("activeExamCycleId")
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ students });
  } catch (e) {
    next(e);
  }
}

export async function getParentStudentProgress(req, res, next) {
  try {
    const { id } = req.params;

    const query = isAdmin(req)
      ? { _id: id }
      : { _id: id, parentIds: getParentId(req) };

    const student = await Student.findOne(query)
      .select("_id progressItems")
      .lean();

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    return res.json({
      items: student.progressItems?.length
        ? student.progressItems
        : DEFAULT_PROGRESS_ITEMS,
    });
  } catch (e) {
    next(e);
  }
}
