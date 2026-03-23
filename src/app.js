import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";

import { connectDB } from "./db.js";

import authRoutes from "./routes/auth.routes.js";
import examCycleRoutes from "./routes/examCycle.routes.js";
import lessonsRoutes from "./routes/lessons.routes.js";
import parentRoutes from "./routes/parent.routes.js";
import scoreEntryRoutes from "./routes/scoreEntry.routes.js";
import teacherStudentAccessRoutes from "./routes/teacherStudentAccess.routes.js";
import studentRoutes from "./routes/student.routes.js";
import { notFoundHandler, errorHandler } from "./middleware/error.js";

const app = express();

const allowedOrigins = [
  "https://studiopulse.co",
  "https://www.studiopulse.co",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn("Blocked by CORS:", origin);
      return callback(new Error("CORS: Origin not allowed"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// Sanitize req.body and req.params to strip MongoDB operators ($, .).
// Express 5 makes req.query read-only so we cannot use mongoSanitize() as
// middleware directly. Instead we sanitize body/params in-place manually.
app.use((req, _res, next) => {
  if (req.body) {
    mongoSanitize.sanitize(req.body);
  }
  if (req.params) {
    mongoSanitize.sanitize(req.params);
  }
  next();
});
app.use(cookieParser());
app.set("trust proxy", 1);
app.use(
  helmet({
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "StudioPulse API",
    root: true,
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/healthz", (_req, res) => {
  res.send("ok");
});

// Global rate limiter for all /api/ routes (per IP).
// Auth routes have their own stricter limiter on top of this.
const globalLimiter =
  process.env.NODE_ENV === "test"
    ? (_req, _res, next) => next()
    : rateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 100, // 100 requests per minute per IP
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: "Too many requests, please slow down" },
      });

app.use("/api/", globalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/exam-cycles", examCycleRoutes);
app.use("/api/lessons", lessonsRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/score-entries", scoreEntryRoutes);
app.use("/api/teacher-student-access", teacherStudentAccessRoutes);
app.use("/api/students", studentRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
