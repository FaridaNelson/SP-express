/**
 * Parse a query-string value as a boolean.
 * Returns true only for the literal string "true"; everything else is false.
 */
export function parseBoolean(val) {
  return val === "true";
}

/**
 * Validate a query-string value against an allowed set.
 * Returns the value if valid, or throws an HTTP 400 error.
 *
 * @param {string} val   - The raw query-string value
 * @param {string[]} allowed - Allowed enum values
 * @param {string} label - Human-readable name for the error message
 */
export function parseEnum(val, allowed, label) {
  const v = String(val || "").trim();
  if (!allowed.includes(v)) {
    const err = new Error(`Invalid ${label}: "${v}"`);
    err.status = 400;
    throw err;
  }
  return v;
}

export const ALLOWED_INSTRUMENTS = ["Piano", "Voice", "Guitar"];
