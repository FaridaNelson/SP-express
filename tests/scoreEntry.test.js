import request from "supertest";
import app from "../src/app.js";
import AuditLog from "../src/models/AuditLog.js";
import {
  createTestTeacher,
  createTestStudent,
  createTestExamCycle,
  fakeId,
} from "./helpers.js";
import { applyCsrf, createCsrfClient, getCsrfCredentials } from "./csrf.js";

describe("Score Entry API", () => {
  let teacher, token, student, cycle, api;

  beforeEach(async () => {
    api = await createCsrfClient();
    const t = await createTestTeacher();
    teacher = t.user;
    token = t.token;
    student = await createTestStudent(teacher._id);
    cycle = await createTestExamCycle(student._id, teacher._id);
  });

  const validEntry = () => ({
    studentId: student._id.toString(),
    examPreparationCycleId: cycle._id.toString(),
    instrument: "Piano",
    lessonDate: "2026-03-20",
    elementId: "pieceA",
    score: 85,
  });

  // ─── POST /api/score-entries ───────────────────────────────
  describe("POST /api/score-entries", () => {
    it("creates a score entry", async () => {
      const res = await api
        .post("/api/score-entries")
        .set("Authorization", `Bearer ${token}`)
        .send(validEntry());

      expect(res.status).toBe(201);
      expect(res.body.entry.elementId).toBe("pieceA");
      expect(res.body.entry.score).toBe(85);
    });

    it("logs UPSERT_SCORE_ENTRY audit event", async () => {
      const createRes = await api
        .post("/api/score-entries")
        .set("Authorization", `Bearer ${token}`)
        .send(validEntry());
      expect(createRes.status).toBe(201);

      const log = await AuditLog.findOne({ action: "UPSERT_SCORE_ENTRY" });
      expect(log).not.toBeNull();
      expect(log.metadata.elementId).toBe("pieceA");
    });

    it("rejects missing required fields", async () => {
      const res = await api
        .post("/api/score-entries")
        .set("Authorization", `Bearer ${token}`)
        .send({ instrument: "Piano" });

      expect(res.status).toBe(400);
    });

    it("rejects unauthenticated request", async () => {
      const res = await api.post("/api/score-entries").send(validEntry());
      expect(res.status).toBe(401);
    });

    it("rejects teacher without edit access", async () => {
      const { token: otherToken } = await createTestTeacher({
        email: "no-score-access@test.com",
      });

      const res = await api
        .post("/api/score-entries")
        .set("Authorization", `Bearer ${otherToken}`)
        .send(validEntry());

      expect(res.status).toBe(403);
    });

    it("rejects cycle that doesn't match student", async () => {
      const { user: other } = await createTestTeacher({
        email: "other-score@test.com",
      });
      const otherStudent = await createTestStudent(other._id, {
        email: "other-score-student@test.com",
      });
      const otherCycle = await createTestExamCycle(otherStudent._id, other._id);

      const entry = validEntry();
      entry.examPreparationCycleId = otherCycle._id.toString();

      const res = await api
        .post("/api/score-entries")
        .set("Authorization", `Bearer ${token}`)
        .send(entry);

      expect(res.status).toBe(400);
    });

    it("rejects instrument mismatch with cycle", async () => {
      const entry = validEntry();
      entry.instrument = "Voice";

      const res = await api
        .post("/api/score-entries")
        .set("Authorization", `Bearer ${token}`)
        .send(entry);

      // Fails on access check (no Voice access)
      expect(res.status).toBe(403);
    });

    it("rejects invalid lessonDate", async () => {
      const entry = validEntry();
      entry.lessonDate = "not-a-date";

      const res = await api
        .post("/api/score-entries")
        .set("Authorization", `Bearer ${token}`)
        .send(entry);

      expect(res.status).toBe(400);
    });

    it("accepts optional tempo fields", async () => {
      const entry = {
        ...validEntry(),
        tempoCurrent: 80,
        tempoGoal: 120,
        dynamics: "mf throughout",
        articulation: "legato",
      };

      const res = await api
        .post("/api/score-entries")
        .set("Authorization", `Bearer ${token}`)
        .send(entry);

      expect(res.status).toBe(201);
      expect(res.body.entry.tempoCurrent).toBe(80);
      expect(res.body.entry.tempoGoal).toBe(120);
    });

    it("rejects missing CSRF token", async () => {
      const res = await request(app)
        .post("/api/score-entries")
        .set("Cookie", api.credentials.cookie)
        .set("Authorization", `Bearer ${token}`)
        .send(validEntry());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("invalid csrf token");
    });

    it("rejects invalid CSRF token", async () => {
      const res = await request(app)
        .post("/api/score-entries")
        .set("Cookie", api.credentials.cookie)
        .set("X-CSRF-Token", "invalid-token")
        .set("Authorization", `Bearer ${token}`)
        .send(validEntry());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("invalid csrf token");
    });

    it("rejects mismatched CSRF token and cookie", async () => {
      const otherCredentials = await getCsrfCredentials();
      const res = await applyCsrf(request(app).post("/api/score-entries"), {
        token: api.credentials.token,
        cookie: otherCredentials.cookie,
      })
        .set("Authorization", `Bearer ${token}`)
        .send(validEntry());

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("invalid csrf token");
    });
  });
});
