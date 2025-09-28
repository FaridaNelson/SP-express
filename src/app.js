import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { connectDB } from "./db.js";
import authRoutes from "./routes/auth.routes.js";
import soundsliceRoutes from "./routes/soundslice.routes.js";
import { errorHandler } from "./middleware/error.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.get("/healthz", (_req, res) => res.send("ok"));

console.log("Mounting /api/auth ...");
app.use("/api/auth", authRoutes);

app.use("/api/soundslice", soundsliceRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

app.use(errorHandler);

await connectDB();
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
