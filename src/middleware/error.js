import mongoose from "mongoose";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let status = err.status || err.statusCode || 500;
  if (
    err instanceof mongoose.Error.ValidationError ||
    err.name === "ValidationError"
  ) {
    status = 400;
  }
  if (err instanceof mongoose.Error.CastErro || err.name === "CastError") {
    status = 400;
  }
  const message =
    err.message || (status === 400 ? "Invalid request" : "Server error");

  if (process.env.NODE_ENV !== "production") console.error(err);
  res.status(status).json({ error: message });
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: "Not found" });
}
