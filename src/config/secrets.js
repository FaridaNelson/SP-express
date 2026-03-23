import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const REQUIRED_SECRETS = ["MONGODB_URI", "JWT_SECRET"];

/**
 * Load secrets from Google Secret Manager (production) or process.env (dev/test).
 *
 * In production, fetches each secret from GCP using the GCP_PROJECT_ID env var.
 * In development, secrets come from .env via dotenv (already loaded before this runs).
 * In test, secrets come from the test command's env vars.
 */
export async function loadSecrets() {
  const env = process.env.NODE_ENV || "development";

  if (env === "test" || env === "development") {
    // Dev and test rely on process.env (dotenv or command-line)
    validateSecrets();
    return;
  }

  // ── Production: fetch from Google Secret Manager ──────────
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      "GCP_PROJECT_ID environment variable is required in production " +
        "to fetch secrets from Google Secret Manager",
    );
  }

  const client = new SecretManagerServiceClient();

  for (const name of REQUIRED_SECRETS) {
    // Skip if already set (e.g. via Cloud Run env injection)
    if (process.env[name]) continue;

    const secretPath = `projects/${projectId}/secrets/${name}/versions/latest`;

    try {
      const [version] = await client.accessSecretVersion({
        name: secretPath,
      });
      const value = version.payload.data.toString("utf8");
      process.env[name] = value;
    } catch (err) {
      throw new Error(
        `Failed to load secret "${name}" from Google Secret Manager: ${err.message}`,
      );
    }
  }

  validateSecrets();
}

/**
 * Validate that all required secrets are present and meet security requirements.
 * Throws on startup if any check fails — prevents the app from running misconfigured.
 */
function validateSecrets() {
  const env = process.env.NODE_ENV || "development";

  // ── JWT_SECRET must exist in ALL environments ─────────────
  if (!process.env.JWT_SECRET) {
    throw new Error(
      "JWT_SECRET environment variable is required. " +
        "Set it in .env (development), the test command (test), " +
        "or Google Secret Manager (production).",
    );
  }

  // ── JWT_SECRET minimum length (skip in test for convenience) ──
  if (env !== "test" && process.env.JWT_SECRET.length < 32) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\"",
    );
  }

  // ── MONGODB_URI must exist (except in test — handled by MongoMemoryServer) ──
  if (env !== "test" && !process.env.MONGODB_URI) {
    throw new Error(
      "MONGODB_URI environment variable is required. " +
        "Set it in .env (development) or Google Secret Manager (production).",
    );
  }
}
