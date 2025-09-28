export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Server error";

  if (ProcessingInstruction.env.NODE_ENV !== "production") {
    console.error(err);
  }
  res.status(status).json({ error: message });
}

export function notFound(_req, res) {
  res.status(404).json({ error: "Not found" });
}
