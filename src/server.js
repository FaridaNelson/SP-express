import "dotenv/config";
import { loadSecrets } from "./config/secrets.js";

// Load and validate secrets before importing the app or connecting to DB.
// In production this fetches from Google Secret Manager.
// In dev/test it validates that process.env has the required values.
await loadSecrets();

const { connectDB } = await import("./db.js");
const { default: app } = await import("./app.js");

const PORT = process.env.PORT || 4000;
const HOST = "0.0.0.0";

try {
  console.log("Starting StudioPulse API server...");
  console.log("Environment:", process.env.NODE_ENV);
  console.log("PORT from .env or default:", PORT);

  await connectDB();

  app.listen(PORT, HOST, () => {
    console.log(`API listening on ${HOST}:${PORT}`);
  });
} catch (err) {
  console.error("Startup failed:", err);
  process.exit(1);
}
