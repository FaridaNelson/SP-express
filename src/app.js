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

// CORS
const prodOrigins = ["https://studiopulse.co", "https://www.studiopulse.co"];

// allow localhost in dev if needed
const devOrigins = ["http://localhost:5173", "http://localhost:3000"];

const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? prodOrigins
    : [...prodOrigins, ...devOrigins];

const corsOptions = {
  origin(origin, callback) {
    // allow same-origin / non-browser requests
    if (!origin) return callback(null, true);
    return callback(null, allowedOrigins.includes(origin));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Length", "ETag"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Security & logging
// behind nginx/proxy
app.set("trust proxy", 1);

// helmet: keep defaults + referrer policy
app.use(
  helmet({ referrerPolicy: { policy: "strict-origin-when-cross-origin" } })
);
app.use(morgan("dev"));

// Health checks
app.get("/", (_req, res) => {
  res.status(200).json({ ok: true, service: "StudioPulse API", root: true });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get("/healthz", (_req, res) => res.send("ok"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/soundslice", soundsliceRoutes);

// Errors
app.use(notFoundHandler);
app.use(errorHandler);

// Boot
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
