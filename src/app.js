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

// CORS (Express 5 compatible)

const prodOrigins = ["https://studiopulse.co", "https://www.studiopulse.co"];
const devOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? prodOrigins
    : [...prodOrigins, ...devOrigins];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn("Blocked by CORS:", origin);
    return callback(new Error("CORS: Origin not allowed"), false);
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Length", "ETag"],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));

// Parsing & security
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.set("trust proxy", 1);
app.use(
  helmet({ referrerPolicy: { policy: "strict-origin-when-cross-origin" } })
);
app.use(morgan("dev"));

// Health routes
app.get("/", (_req, res) =>
  res.status(200).json({ ok: true, service: "StudioPulse API", root: true })
);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/healthz", (_req, res) => res.send("ok"));

// Main routes
app.use("/api/auth", authRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/soundslice", soundsliceRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Server boot
try {
  await connectDB();
  const PORT = process.env.PORT || 4000;
  const HOST = "0.0.0.0";
  app.listen(PORT, HOST, () => console.log(`API listening on ${HOST}:${PORT}`));
} catch (err) {
  console.error("DB connect failed:", err);
  process.exit(1);
}

export default app;
