import mongoose from "mongoose";

/**
 * Returns middleware that validates one or more route params are valid MongoDB ObjectIds.
 * Responds 400 immediately if any param fails validation — prevents Mongoose CastErrors
 * from bubbling up as 500s or leaking internal error details.
 *
 * Usage:
 *   router.get("/:studentId", validateObjectId("studentId"), handler);
 *   router.post("/:studentId/access/:accessId/revoke",
 *     validateObjectId("studentId", "accessId"), handler);
 */
export function validateObjectId(...paramNames) {
  return (req, res, next) => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return res
          .status(400)
          .json({ error: `Invalid ${name}` });
      }
    }
    next();
  };
}
