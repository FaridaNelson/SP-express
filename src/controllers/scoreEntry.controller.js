import ScoreEntry from "../models/ScoreEntry.js";
import ExamPreparationCycle from "../models/ExamPreparationCycle.js";
import AuditLog from "../models/AuditLog.js";
import { assertTeacherCanEdit } from "../services/access.service.js";
import { recomputeStudentReadModels } from "../services/summary.service.js";
import { validateObjectId } from "../utils/validate.js";

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeString(value, fieldName) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${fieldName} cannot be empty`);
  }

  return trimmed;
}

function buildAiText({
  instrument,
  lessonDate,
  elementLabel,
  elementType,
  score,
  criteria = [],
  notes = {},
}) {
  const dateText = lessonDate?.toISOString?.().slice(0, 10) || "";

  const criteriaText = criteria
    .map(
      (item) => `${item.label || item.key}: ${item.value || item.score || ""}`,
    )
    .filter(Boolean)
    .join(". ");

  const notesText = Object.entries(notes)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${JSON.stringify(value)}`;
      }

      if (typeof value === "object" && value !== null) {
        return `${key}: ${JSON.stringify(value)}`;
      }

      return `${key}: ${value}`;
    })
    .join(". ");

  return [
    `${instrument} lesson on ${dateText}.`,
    `${elementType}: ${elementLabel}.`,
    `Overall score: ${score}.`,
    criteriaText,
    notesText,
  ]
    .filter(Boolean)
    .join(" ");
}

const PIECE_ELEMENT_IDS = ["pieceA", "pieceB", "pieceC", "pieceD"];

function buildScoreEntrySetPayload({
  safeInstrument,
  parsedLessonDate,
  safeElementId,
  safeElementLabel,
  score,
  tempoCurrent,
  tempoGoal,
  pieceCriteria,
  scalesNotes,
  sightReadingNotes,
  auralTrainingNotes,
}) {
  const setPayload = {
    instrument: safeInstrument,
    lessonDate: parsedLessonDate,
    elementLabel: safeElementLabel,
    score,
  };

  const unsetPayload = {};

  if (PIECE_ELEMENT_IDS.includes(safeElementId)) {
    setPayload.elementType = "piece";
    setPayload.criteria = pieceCriteria || [];
    setPayload.notes = {
      tempoCurrent: tempoCurrent ?? null,
      tempoGoal: tempoGoal ?? null,
    };
    setPayload.tempoCurrent = tempoCurrent ?? null;
    setPayload.tempoGoal = tempoGoal ?? null;

    setPayload.aiText = buildAiText({
      instrument: safeInstrument,
      lessonDate: parsedLessonDate,
      elementLabel: safeElementLabel || safeElementId,
      elementType: "piece",
      score,
      criteria: pieceCriteria || [],
      notes: setPayload.notes,
    });

    unsetPayload.sightReadingNotes = "";
    unsetPayload.auralTrainingNotes = "";
  } else if (safeElementId === "sightReading") {
    const normalizedSightReadingNotes = {
      pitchAccuracy: sightReadingNotes?.pitchAccuracy || "",
      rhythmAccuracy: sightReadingNotes?.rhythmAccuracy || "",
      adequateTempo: sightReadingNotes?.adequateTempo || "",
      confidentPresentation: sightReadingNotes?.confidentPresentation || "",
    };

    setPayload.elementType = "sightReading";
    setPayload.sightReadingNotes = normalizedSightReadingNotes;
    setPayload.notes = normalizedSightReadingNotes;
    setPayload.criteria = [
      {
        key: "pitchAccuracy",
        label: "Pitch Accuracy",
        value: normalizedSightReadingNotes.pitchAccuracy,
      },
      {
        key: "rhythmAccuracy",
        label: "Rhythm Accuracy",
        value: normalizedSightReadingNotes.rhythmAccuracy,
      },
      {
        key: "adequateTempo",
        label: "Adequate Tempo",
        value: normalizedSightReadingNotes.adequateTempo,
      },
      {
        key: "confidentPresentation",
        label: "Confident Presentation",
        value: normalizedSightReadingNotes.confidentPresentation,
      },
    ];
    unsetPayload.auralTrainingNotes = "";
    unsetPayload.tempoCurrent = "";
    unsetPayload.tempoGoal = "";

    setPayload.aiText = buildAiText({
      instrument: safeInstrument,
      lessonDate: parsedLessonDate,
      elementLabel: safeElementLabel || "Sight Reading",
      elementType: "sightReading",
      score,
      criteria: setPayload.criteria,
      notes: setPayload.notes,
    });
  } else if (safeElementId === "auralTraining") {
    const normalizedAuralTrainingNotes = {
      rhythmAccuracy: auralTrainingNotes?.rhythmAccuracy || "",
      singingInPitch: auralTrainingNotes?.singingInPitch || "",
      musicalMemory: auralTrainingNotes?.musicalMemory || "",
      musicalPerceptiveness: auralTrainingNotes?.musicalPerceptiveness || "",
    };

    setPayload.elementType = "auralTraining";
    setPayload.auralTrainingNotes = normalizedAuralTrainingNotes;
    setPayload.notes = normalizedAuralTrainingNotes;
    setPayload.criteria = [
      {
        key: "rhythmAccuracy",
        label: "Rhythm Accuracy",
        value: normalizedAuralTrainingNotes.rhythmAccuracy,
      },
      {
        key: "singingInPitch",
        label: "Singing in Pitch",
        value: normalizedAuralTrainingNotes.singingInPitch,
      },
      {
        key: "musicalMemory",
        label: "Musical Memory",
        value: normalizedAuralTrainingNotes.musicalMemory,
      },
      {
        key: "musicalPerceptiveness",
        label: "Musical Perceptiveness",
        value: normalizedAuralTrainingNotes.musicalPerceptiveness,
      },
    ];
    unsetPayload.sightReadingNotes = "";
    unsetPayload.tempoCurrent = "";
    unsetPayload.tempoGoal = "";

    setPayload.aiText = buildAiText({
      instrument: safeInstrument,
      lessonDate: parsedLessonDate,
      elementLabel: safeElementLabel || "Aural Training",
      elementType: "auralTraining",
      score,
      criteria: setPayload.criteria,
      notes: setPayload.notes,
    });
  } else if (safeElementId === "scales") {
    setPayload.elementType = "scales";

    setPayload.notes = {
      items: Object.entries(scalesNotes || {}).map(([scaleId, value]) => ({
        scaleId,
        ready:
          value?.ready === true ? true : value?.ready === false ? false : null,

        currentTempo: value?.currentTempo || null,
        goalTempoSnapshot: value?.goalTempo || null,

        teacherNote: value?.note || "",
      })),
    };

    setPayload.aiText = buildAiText({
      instrument: safeInstrument,
      lessonDate: parsedLessonDate,
      elementLabel: safeElementLabel || "Scales",
      elementType: "scales",
      score,
      notes: setPayload.notes,
    });

    unsetPayload.criteria = "";
    unsetPayload.sightReadingNotes = "";
    unsetPayload.auralTrainingNotes = "";
    unsetPayload.tempoCurrent = "";
    unsetPayload.tempoGoal = "";
  }

  return { setPayload, unsetPayload };
}

export async function createScoreEntry(req, res, next) {
  try {
    const {
      studentId,
      examPreparationCycleId,
      lessonId,
      instrument,
      lessonDate,
      elementId,
      elementLabel,
      score,
      tempoCurrent,
      tempoGoal,
      pieceCriteria,
      scalesNotes,
      sightReadingNotes,
      auralTrainingNotes,
    } = req.body || {};

    const teacherId = req.user._id;

    if (
      !studentId ||
      !examPreparationCycleId ||
      !instrument ||
      !lessonDate ||
      !elementId
    ) {
      return res.status(400).json({
        error:
          "studentId, examPreparationCycleId, instrument, lessonDate, and elementId are required",
      });
    }

    const safeStudentId = validateObjectId(studentId, "studentId");
    const safeCycleId = validateObjectId(
      examPreparationCycleId,
      "examPreparationCycleId",
    );

    const safeLessonId = lessonId
      ? validateObjectId(lessonId, "lessonId")
      : null;
    const safeInstrument = normalizeString(instrument, "instrument");
    const safeElementId = normalizeString(elementId, "elementId");
    const safeElementLabel =
      typeof elementLabel === "string" ? elementLabel.trim() : "";

    await assertTeacherCanEdit(teacherId, safeStudentId, safeInstrument);

    const parsedLessonDate = normalizeDate(lessonDate);
    if (!parsedLessonDate) {
      return res.status(400).json({ error: "Invalid lessonDate" });
    }

    const cycle = await ExamPreparationCycle.findById(safeCycleId)
      .select("_id studentId instrument archivedAt")
      .lean();

    if (!cycle || cycle.archivedAt) {
      return res.status(404).json({ error: "Cycle not found" });
    }

    if (String(cycle.studentId) !== String(safeStudentId)) {
      return res.status(400).json({ error: "Cycle mismatch" });
    }

    if (cycle.instrument !== safeInstrument) {
      return res.status(400).json({ error: "Instrument mismatch" });
    }

    const { setPayload, unsetPayload } = buildScoreEntrySetPayload({
      safeInstrument,
      parsedLessonDate,
      safeElementId,
      safeElementLabel,
      score,
      tempoCurrent,
      tempoGoal,
      sightReadingNotes,
      auralTrainingNotes,
      pieceCriteria,
      scalesNotes,
    });

    const entry = await ScoreEntry.findOneAndUpdate(
      {
        createdByTeacherId: teacherId,
        studentId: safeStudentId,
        examPreparationCycleId: safeCycleId,
        lessonId: safeLessonId,
        lessonDate: parsedLessonDate,
        elementId: safeElementId,
        archivedAt: null,
      },
      {
        $set: setPayload,
        ...(Object.keys(unsetPayload).length > 0
          ? { $unset: unsetPayload }
          : {}),
        $setOnInsert: {
          createdByTeacherId: teacherId,
          studentId: safeStudentId,
          examPreparationCycleId: safeCycleId,
          lessonId: safeLessonId,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    await recomputeStudentReadModels(safeStudentId);

    await AuditLog.create({
      actorUserId: teacherId,
      actorRoles: Array.isArray(req.user.roles) ? req.user.roles : [],
      action: "UPSERT_SCORE_ENTRY",
      targetType: "ScoreEntry",
      targetId: entry._id,
      studentId: safeStudentId,
      metadata: {
        examPreparationCycleId: safeCycleId,
        instrument: safeInstrument,
        lessonDate: parsedLessonDate,
        elementId: safeElementId,
        elementLabel: safeElementLabel,
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
    });

    return res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
}
