import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cokieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());
app.use(cokieParser());

app.get("/healthz", (_req, res) => res.send("ok"));

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
