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
