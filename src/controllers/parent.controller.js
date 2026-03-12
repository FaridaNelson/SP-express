import Student from "../models/Student.js";
import ExamPreparationCycle from "../models/ExamPreparationCycle.js";

function getParentId(req) {
  return req.user?._id;
}

export async function getParentStudents(req, res, next) {
  try {
    const parentId = getParentId(req);

    if (!parentId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const students = await Student.find({ parentIds: parentId })
      .select(
        "_id name email instrument grade teacherId parentIds studentUserId activeExamCycleId",
      )
      .populate("activeExamCycleId")
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ students });
  } catch (e) {
    next(e);
  }
}
