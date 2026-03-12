import ExamPreparationCycle from "../models/ExamPreparationCycle.js";
import Student from "../models/Student.js";

function getTeacherId(req) {
  return req.user?._id;
}

export async function createCycle(req, res, next) {
  try {
    const teacherId = getTeacherId(req);
    const { studentId, examType, examGrade } = req.body || {};

    if (!teacherId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!studentId || !examType || !examGrade) {
      return res.status(400).json({
        error: "studentId, examType, and examGrade are required",
      });
    }

    const student = await Student.findOne({ _id: studentId, teacherId });
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const existingCycle = await ExamPreparationCycle.findOne({
      studentId,
      archivedAt: null,
    });

    if (existingCycle) {
      return res.status(409).json({
        error: "Student already has an active exam cycle",
      });
    }

    const cycle = await ExamPreparationCycle.create({
      studentId,
      teacherId,
      examType,
      examGrade,
      status: "current",
      examTaken: null,
      archivedAt: null,
    });

    student.activeExamCycleId = cycle._id;
    await student.save();

    return res.status(201).json({ cycle });
  } catch (e) {
    next(e);
  }
}

export async function getActiveCycleForStudent(req, res, next) {
  try {
    const teacherId = getTeacherId(req);
    const { studentId } = req.params;

    const student = await Student.findOne({ _id: studentId, teacherId }).lean();
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const cycle = await ExamPreparationCycle.findOne({
      studentId,
      archivedAt: null,
    }).lean();

    return res.json({ cycle: cycle || null });
  } catch (e) {
    next(e);
  }
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

    if (
      (currentStatus === "current" || currentStatus === "registered") &&
      status === "withdrawn"
    ) {
      if (examTaken !== false) {
        return res.status(400).json({
          error: "examTaken must be false when withdrawing a cycle",
        });
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

    if (currentStatus === "registered" && status === "completed") {
      if (examTaken !== true) {
        return res.status(400).json({
          error: "examTaken must be true when completing a cycle",
        });
      }

      cycle.status = "completed";
      cycle.examTaken = true;
      cycle.closingNote = closingNote?.trim() || cycle.closingNote || "";

      if (examDate) cycle.examDate = examDate;
      if (examLocation !== undefined) cycle.examLocation = examLocation;

      if (completion && typeof completion === "object") {
        const currentCompletion =
          typeof cycle.completion?.toObject === "function"
            ? cycle.completion.toObject()
            : cycle.completion || {};

        cycle.completion = {
          ...currentCompletion,
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

export async function archiveCycle(req, res, next) {
  try {
    const teacherId = getTeacherId(req);
    const { cycleId } = req.params;
    const { closingNote } = req.body || {};

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

    if (!["completed", "withdrawn"].includes(cycle.status)) {
      return res.status(400).json({
        error: "Only completed or withdrawn cycles can be archived",
      });
    }

    cycle.archivedAt = new Date();
    if (closingNote?.trim()) {
      cycle.closingNote = closingNote.trim();
    }

    await cycle.save();

    await Student.updateOne(
      { _id: cycle.studentId, teacherId },
      { $set: { activeExamCycleId: null } },
    );

    return res.json({ cycle });
  } catch (e) {
    next(e);
  }
}
