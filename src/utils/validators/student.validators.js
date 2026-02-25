export const ALLOWED_INSTRUMENTS = new Set(["Piano", "Voice", "Guitar"]);

export function normalizeInstrument(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateInstrument(instrument) {
  const inst = normalizeInstrument(instrument);
  if (!ALLOWED_INSTRUMENTS.has(inst)) {
    const allowed = Array.from(ALLOWED_INSTRUMENTS).join(", ");
    return { ok: false, message: `Invalid instrument. Allowed: ${allowed}` };
  }
  return { ok: true, value: inst };
}

export function validateGradeRequired(grade) {
  // grade must be present
  if (grade === undefined || grade === null || grade === "") {
    return { ok: false, message: "Grade is required." };
  }

  const g = Number(grade);
  if (!Number.isInteger(g) || g < 1 || g > 8) {
    return { ok: false, message: "Invalid grade. Must be an integer 1–8." };
  }
  return { ok: true, value: g };
}
