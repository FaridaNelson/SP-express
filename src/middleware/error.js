import mongoose from "mongoose";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = err.status || err.statusCode || 500;

  // jsonwebtoken
  if (err.name === "JsonWebTokenError" || err.name === "UnauthorizedError") {
    status = 401;
  }
  if (err.name === "TokenExpiredError") {
    status = 401;
  }

  // Mongoose validation & casting
  if (
    err instanceof mongoose.Error.ValidationError ||
    err.name === "ValidationError"
  ) {
    status = 400;
  }
  if (err instanceof mongoose.Error.CastError || err.name === "CastError") {
    status = 400;
  }

  // Duplicate key - unique email
  if (err.name === "MongoServerError" && err.code === 11000) {
    status = 409;
  }

  // Malformed JSON body (from express.json)
  if (err.type === "entity.parse.failed") {
    status = 400;
  }

  const message =
    err.message ||
    (status === 400
      ? "Invalid request"
      : status === 401
      ? "Unauthorized"
      : status === 403
      ? "Forbidden"
      : status === 404
      ? "Not found"
      : status === 409
      ? "Conflict"
      : "Server error");

  if (process.env.NODE_ENV !== "production") {
    console.error("[ERROR]", { status, message, stack: err.stack });
  }

  res.status(status).json({ error: message });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: "Not found" });
}
