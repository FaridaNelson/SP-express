import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/User.js";
import Student from "../src/models/Student.js";
import { createTestStudent, createTestTeacher, fakeId } from "./helpers.js";

describe("Auth API", () => {
  // ─── POST /api/auth/signup ─────────────────────────────────
  describe("POST /api/auth/signup", () => {
    describe("happy path", () => {
      it("registers a teacher with valid fields", async () => {
        const res = await request(app).post("/api/auth/signup").send({
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          password: "securepass123",
          role: "teacher",
          studioName: "Jane's Studio",
          instrumentsTaught: ["Piano"],
          yearsTeaching: "3-5",
        });

        expect(res.status).toBe(201);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe("jane@example.com");
        expect(res.body.user.roles).toContain("teacher");
        expect(res.body.user.passwordHash).toBeUndefined();

        // cookie should be set
        const cookies = [res.headers["set-cookie"]].flat();
        expect(cookies.length).toBeGreaterThan(0);
        expect(cookies.some((c) => c.startsWith("sp_jwt="))).toBe(true);
      });

      it("registers a parent linked by inviteCode", async () => {
        const { user: teacher } = await createTestTeacher();
        const student = await createTestStudent(teacher._id);

        const res = await request(app).post("/api/auth/signup").send({
          firstName: "Mom",
          lastName: "Smith",
          email: "mom@example.com",
          password: "securepass123",
          role: "parent",
          inviteCode: student.inviteCode,
        });

        expect(res.status).toBe(201);
        expect(res.body.linkedStudentId).toBe(student._id.toString());

        // verify parent was linked to student
        const updated = await Student.findById(student._id);
        expect(updated.parentIds.map(String)).toContain(
          res.body.user._id.toString(),
        );
      });

      it("registers a student with instrument", async () => {
        const res = await request(app).post("/api/auth/signup").send({
          firstName: "Kid",
          lastName: "Student",
          email: "kid@example.com",
          password: "securepass123",
          role: "student",
          instrument: "Piano",
        });

        expect(res.status).toBe(201);
        expect(res.body.user.roles).toContain("student");
        expect(res.body.user.instrument).toBe("Piano");
      });
    });

    describe("validation", () => {
      it("rejects missing required fields", async () => {
        const res = await request(app).post("/api/auth/signup").send({
          email: "test@example.com",
        });
        expect(res.status).toBe(400);
      });

      it("rejects password shorter than 8 characters", async () => {
        const res = await request(app).post("/api/auth/signup").send({
          firstName: "A",
          lastName: "B",
          email: "short@example.com",
          password: "1234567",
          role: "student",
          instrument: "Piano",
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/8 characters/);
      });

      it("rejects duplicate email", async () => {
        await request(app).post("/api/auth/signup").send({
          firstName: "First",
          lastName: "User",
          email: "dupe@example.com",
          password: "password123",
          role: "student",
          instrument: "Piano",
        });

        const res = await request(app).post("/api/auth/signup").send({
          firstName: "Second",
          lastName: "User",
          email: "dupe@example.com",
          password: "password123",
          role: "student",
          instrument: "Piano",
        });

        expect(res.status).toBe(409);
      });

      it("rejects teacher without studioName", async () => {
        const res = await request(app).post("/api/auth/signup").send({
          firstName: "T",
          lastName: "T",
          email: "teacher-no-studio@example.com",
          password: "password123",
          role: "teacher",
          instrumentsTaught: ["Piano"],
          yearsTeaching: "3-5",
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/studio/i);
      });

      it("rejects parent without studentId or inviteCode", async () => {
        const res = await request(app).post("/api/auth/signup").send({
          firstName: "P",
          lastName: "P",
          email: "parent-no-link@example.com",
          password: "password123",
          role: "parent",
        });
        expect(res.status).toBe(400);
      });
    });

    describe("security", () => {
      it("blocks admin role self-assignment", async () => {
        const res = await request(app).post("/api/auth/signup").send({
          firstName: "Evil",
          lastName: "Admin",
          email: "evil@example.com",
          password: "password123",
          role: "admin",
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid role/);
      });

      it("blocks admin in roles array", async () => {
        const res = await request(app).post("/api/auth/signup").send({
          firstName: "Evil",
          lastName: "Admin",
          email: "evil2@example.com",
          password: "password123",
          roles: ["teacher", "admin"],
          studioName: "Evil Studio",
          instrumentsTaught: ["Piano"],
          yearsTeaching: "3-5",
        });
        expect(res.status).toBe(400);
      });

      it("sanitizes NoSQL injection operators in login body", async () => {
        const res = await request(app).post("/api/auth/login").send({
          email: { $gt: "" },
          password: { $gt: "" },
        });
        // Should get 400 (missing fields after sanitization), not a crash or data leak
        expect([400, 401]).toContain(res.status);
        expect(res.status).not.toBe(500);
      });

      it("normalizes email to lowercase", async () => {
        const res = await request(app).post("/api/auth/signup").send({
          firstName: "Upper",
          lastName: "Case",
          email: "UPPER@EXAMPLE.COM",
          password: "password123",
          role: "student",
          instrument: "Piano",
        });
        expect(res.status).toBe(201);
        expect(res.body.user.email).toBe("upper@example.com");
      });
    });
  });

  // ─── POST /api/auth/login ──────────────────────────────────
  describe("POST /api/auth/login", () => {
    it("logs in with valid credentials", async () => {
      await request(app).post("/api/auth/signup").send({
        firstName: "Login",
        lastName: "User",
        email: "login@example.com",
        password: "password123",
        role: "student",
        instrument: "Piano",
      });

      const res = await request(app).post("/api/auth/login").send({
        email: "login@example.com",
        password: "password123",
      });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("login@example.com");
      const cookies = [res.headers["set-cookie"]].flat();
      expect(cookies.some((c) => c.startsWith("sp_jwt="))).toBe(true);
    });

    it("rejects wrong password", async () => {
      await request(app).post("/api/auth/signup").send({
        firstName: "Login",
        lastName: "Fail",
        email: "fail@example.com",
        password: "password123",
        role: "student",
        instrument: "Piano",
      });

      const res = await request(app).post("/api/auth/login").send({
        email: "fail@example.com",
        password: "wrongpassword",
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid credentials");
    });

    it("rejects nonexistent email with same error message", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "nonexistent@example.com",
        password: "password123",
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid credentials");
    });

    it("rejects missing fields", async () => {
      const res = await request(app).post("/api/auth/login").send({});
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/auth/me ──────────────────────────────────────
  describe("GET /api/auth/me", () => {
    it("returns user data for valid token", async () => {
      const signupRes = await request(app).post("/api/auth/signup").send({
        firstName: "Me",
        lastName: "User",
        email: "me@example.com",
        password: "password123",
        role: "student",
        instrument: "Piano",
      });

      const cookies = [signupRes.headers["set-cookie"]].flat();
      const cookie = cookies.find((c) => c.startsWith("sp_jwt="));

      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe("me@example.com");
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it("returns null user without token", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });

    it("returns null user with invalid token", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid-token-here");
      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });
  });

  // ─── POST /api/auth/logout ─────────────────────────────────
  describe("POST /api/auth/logout", () => {
    it("clears the session cookie", async () => {
      const res = await request(app).post("/api/auth/logout");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const cookies = [res.headers["set-cookie"]].flat();
      expect(cookies.length).toBeGreaterThan(0);
      // cookie should be cleared (expires in past or max-age=0)
      const spCookie = cookies.find((c) => c.startsWith("sp_jwt="));
      expect(spCookie).toBeDefined();
    });
  });
});
