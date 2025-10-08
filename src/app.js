import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { connectDB } from "./db.js";
import authRoutes from "./routes/auth.routes.js";
import teacherRoutes from "./routes/teacher.routes.js";
import parentRoutes from "./routes/parent.routes.js";
import soundsliceRoutes from "./routes/soundslice.routes.js";
import { notFoundHandler, errorHandler } from "./middleware/error.js";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);
app.use(
  helmet({ referrerPolicy: { policy: "strict-origin-when-cross-origin" } })
);
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.use("/api/auth", authRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/soundslice", soundsliceRoutes);

app.use(notFoundHandler);

app.use(errorHandler);

try {
  await connectDB();
  const PORT = process.env.PORT || 4000;
  const HOST = "0.0.0.0"; // Listen on all interfaces

  app.listen(PORT, HOST, () => console.log(`API listening on ${HOST}:${PORT}`));
} catch (err) {
  console.error("DB connect failed:", err);
  process.exit(1);
}
export default app;
