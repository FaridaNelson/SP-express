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
    origin: ["http://localhost:3000"],
    credentials: true,
  })
);
app.use(
  helmet({ referrerPolicy: { policy: "strict-origin-when-cross-origin" } })
);
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

app.get("/healthz", (_req, res) => res.send("ok"));

app.use("/api/auth", authRoutes);
app.use("/api/teacher", teacherRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/soundslice", soundsliceRoutes);

app.use(notFoundHandler);

app.use(errorHandler);

await connectDB();
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on :${PORT}`));
