import crypto from "node:crypto";
import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/User.js";

describe("Password Reset API", () => {
  const signupUser = async (email = "reset@example.com") => {
    await request(app).post("/api/auth/signup").send({
      firstName: "Reset",
      lastName: "User",
      email,
      password: "password123",
      role: "student",
      instrument: "Piano",
    });
  };

  // ─── POST /api/auth/forgot-password ──────────────────────────
  describe("POST /api/auth/forgot-password", () => {
    it("returns 200 with message ok for existing email", async () => {
      await signupUser();

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "reset@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("ok");

      // token should be stored (hashed) on the user
      const user = await User.findOne({ email: "reset@example.com" });
      expect(user.passwordResetToken).toBeDefined();
      expect(user.passwordResetToken).not.toBeNull();
      expect(user.passwordResetExpires).toBeDefined();
      expect(new Date(user.passwordResetExpires).getTime()).toBeGreaterThan(
        Date.now(),
      );
    });

    it("returns 200 with message ok for non-existent email", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "nobody@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("ok");
    });

    it("returns 200 with message ok when email is missing", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("ok");
    });

    it("is case-insensitive for email lookup", async () => {
      await signupUser("casetest@example.com");

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "CASETEST@EXAMPLE.COM" });

      expect(res.status).toBe(200);

      const user = await User.findOne({ email: "casetest@example.com" });
      expect(user.passwordResetToken).not.toBeNull();
    });
  });

  // ─── POST /api/auth/reset-password ───────────────────────────
  describe("POST /api/auth/reset-password", () => {
    async function createResetToken(email = "reset@example.com") {
      await signupUser(email);

      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      await User.updateOne(
        { email },
        {
          passwordResetToken: hashedToken,
          passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
        },
      );

      return rawToken;
    }

    it("resets password with a valid token", async () => {
      const rawToken = await createResetToken();

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: rawToken, newPassword: "newpass12345" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Password updated");

      // token fields should be cleared
      const user = await User.findOne({ email: "reset@example.com" });
      expect(user.passwordResetToken).toBeNull();
      expect(user.passwordResetExpires).toBeNull();

      // should be able to log in with new password
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: "reset@example.com", password: "newpass12345" });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.email).toBe("reset@example.com");
    });

    it("rejects an expired token", async () => {
      await signupUser("expired@example.com");

      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

      await User.updateOne(
        { email: "expired@example.com" },
        {
          passwordResetToken: hashedToken,
          passwordResetExpires: new Date(Date.now() - 1000), // already expired
        },
      );

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: rawToken, newPassword: "newpass12345" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid or expired token");
    });

    it("rejects an invalid token", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: "not-a-real-token", newPassword: "newpass12345" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid or expired token");
    });

    it("rejects password shorter than 8 characters", async () => {
      const rawToken = await createResetToken("short@example.com");

      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: rawToken, newPassword: "short" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/8 characters/);
    });

    it("rejects missing token or password", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({});

      expect(res.status).toBe(400);
    });

    it("prevents token reuse after successful reset", async () => {
      const rawToken = await createResetToken("reuse@example.com");

      // first reset succeeds
      const res1 = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: rawToken, newPassword: "newpass12345" });
      expect(res1.status).toBe(200);

      // second reset with same token fails
      const res2 = await request(app)
        .post("/api/auth/reset-password")
        .send({ token: rawToken, newPassword: "anotherpass123" });
      expect(res2.status).toBe(400);
      expect(res2.body.error).toBe("Invalid or expired token");
    });
  });
});
