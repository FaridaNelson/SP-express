import ExamPreparationCycle from "../models/ExamPreparationCycle.js";
import Student from "../models/Student.js";

function getTeacherId(req) {
  return req.user?._id;
}

export async function updateCycleStatus(req, res, next) {
  try {
    const teacherId = getTeacherId(req);
    const { cycleId } = req.params;
    const {
      status,
      examDate,
      examLocation,
      examTaken,
      withdrawalReason,
      closingNote,
      completion,
    } = req.body || {};

    if (!teacherId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const cycle = await ExamPreparationCycle.findOne({
      _id: cycleId,
      teacherId,
      archivedAt: null,
    });

    if (!cycle) {
      return res.status(404).json({ error: "Active cycle not found" });
    }

    const currentStatus = cycle.status;

    // current -> registered
    if (currentStatus === "current" && status === "registered") {
      if (!examDate) {
        return res.status(400).json({ error: "examDate is required" });
      }

      if (cycle.examType === "Practical" && !examLocation) {
        return res
          .status(400)
          .json({ error: "examLocation is required for Practical exams" });
      }

      cycle.status = "registered";
      cycle.examDate = examDate;
      cycle.examLocation = examLocation || "";
      await cycle.save();

      return res.json({ cycle });
    }

    // current/registered -> withdrawn
    if (
      (currentStatus === "current" || currentStatus === "registered") &&
      status === "withdrawn"
    ) {
      if (examTaken !== false) {
        return res
          .status(400)
          .json({ error: "examTaken must be false when withdrawing a cycle" });
      }

      if (!withdrawalReason?.trim()) {
        return res.status(400).json({ error: "withdrawalReason is required" });
      }

      cycle.status = "withdrawn";
      cycle.examTaken = false;
      cycle.withdrawalReason = withdrawalReason.trim();
      cycle.closingNote = closingNote?.trim() || cycle.closingNote || "";
      await cycle.save();

      return res.json({ cycle });
    }

    // registered -> completed
    if (currentStatus === "registered" && status === "completed") {
      if (examTaken !== true) {
        return res
          .status(400)
          .json({ error: "examTaken must be true when completing a cycle" });
      }

      cycle.status = "completed";
      cycle.examTaken = true;
      cycle.closingNote = closingNote?.trim() || cycle.closingNote || "";

      if (examDate) cycle.examDate = examDate;
      if (examLocation !== undefined) cycle.examLocation = examLocation;

      if (completion && typeof completion === "object") {
        cycle.completion = {
          ...cycle.completion?.toObject?.(),
          ...completion,
        };
      }

      await cycle.save();
      return res.json({ cycle });
    }

    return res.status(400).json({
      error: `Invalid status transition from "${currentStatus}" to "${status}"`,
    });
  } catch (e) {
    next(e);
  }
}
