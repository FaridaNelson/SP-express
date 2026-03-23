import request from "supertest";
import app from "../src/app.js";
import Student from "../src/models/Student.js";
import AuditLog from "../src/models/AuditLog.js";
import {
  createTestTeacher,
  createTestAdmin,
  createTestStudent,
  createTestExamCycle,
  fakeId,
} from "./helpers.js";

describe("Exam Cycle API", () => {
  // ─── POST /api/exam-cycles ─────────────────────────────────
  describe("POST /api/exam-cycles", () => {
    it("creates a Practical cycle with correct requiredElements", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);

      const res = await request(app)
        .post("/api/exam-cycles")
        .set("Authorization", `Bearer ${token}`)
        .send({
          studentId: student._id.toString(),
          instrument: "Piano",
          examType: "Practical",
          examGrade: 3,
        });

      expect(res.status).toBe(201);
      expect(res.body.cycle.examType).toBe("Practical");
      expect(res.body.cycle.progressSummary.requiredElements).toEqual([
        "pieceA",
        "pieceB",
        "pieceC",
        "scales",
        "sightReading",
        "auralTraining",
      ]);

      // verify student's activeExamCycleId was set
      const updated = await Student.findById(student._id);
      expect(updated.activeExamCycleId.toString()).toBe(
        res.body.cycle._id.toString(),
      );
    });

    it("creates a Performance cycle with 4 pieces only", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);

      const res = await request(app)
        .post("/api/exam-cycles")
        .set("Authorization", `Bearer ${token}`)
        .send({
          studentId: student._id.toString(),
          instrument: "Piano",
          examType: "Performance",
          examGrade: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.cycle.progressSummary.requiredElements).toEqual([
        "pieceA",
        "pieceB",
        "pieceC",
        "pieceD",
      ]);
    });

    it("rejects missing required fields", async () => {
      const { token } = await createTestTeacher();
      const res = await request(app)
        .post("/api/exam-cycles")
        .set("Authorization", `Bearer ${token}`)
        .send({ instrument: "Piano" });

      expect(res.status).toBe(400);
    });

    it("rejects teacher without edit access to student", async () => {
      const { user: teacher1 } = await createTestTeacher();
      const student = await createTestStudent(teacher1._id);

      const { token: otherToken } = await createTestTeacher({
        email: "other-cycle@test.com",
      });

      const res = await request(app)
        .post("/api/exam-cycles")
        .set("Authorization", `Bearer ${otherToken}`)
        .send({
          studentId: student._id.toString(),
          instrument: "Piano",
          examType: "Practical",
          examGrade: 3,
        });

      expect(res.status).toBe(403);
    });

    it("rejects unauthenticated request", async () => {
      const res = await request(app).post("/api/exam-cycles").send({
        studentId: fakeId(),
        instrument: "Piano",
        examType: "Practical",
        examGrade: 3,
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/exam-cycles/:cycleId (BOLA protection) ──────
  describe("GET /api/exam-cycles/:cycleId", () => {
    it("returns cycle for authorized teacher", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);
      const cycle = await createTestExamCycle(student._id, user._id);

      const res = await request(app)
        .get(`/api/exam-cycles/${cycle._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cycle._id).toBe(cycle._id.toString());
    });

    it("returns 404 (not 403) for unauthorized teacher — BOLA protection", async () => {
      const { user: teacher1 } = await createTestTeacher();
      const student = await createTestStudent(teacher1._id);
      const cycle = await createTestExamCycle(student._id, teacher1._id);

      const { token: otherToken } = await createTestTeacher({
        email: "bola@test.com",
      });

      const res = await request(app)
        .get(`/api/exam-cycles/${cycle._id}`)
        .set("Authorization", `Bearer ${otherToken}`);

      // Should be 404, NOT 403 — prevents enumeration
      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent cycle", async () => {
      const { token } = await createTestTeacher();
      const res = await request(app)
        .get(`/api/exam-cycles/${fakeId()}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it("returns 404 for archived cycle", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);
      const cycle = await createTestExamCycle(student._id, user._id);
      cycle.archivedAt = new Date();
      await cycle.save();

      const res = await request(app)
        .get(`/api/exam-cycles/${cycle._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid ObjectId format", async () => {
      const { token } = await createTestTeacher();
      const res = await request(app)
        .get("/api/exam-cycles/not-valid")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid cycleId/);
    });
  });

  // ─── GET /api/exam-cycles/student/:studentId ───────────────
  describe("GET /api/exam-cycles/student/:studentId", () => {
    it("lists cycles for student", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);
      await createTestExamCycle(student._id, user._id);
      await createTestExamCycle(student._id, user._id, {
        examType: "Performance",
      });

      const res = await request(app)
        .get(`/api/exam-cycles/student/${student._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.cycles).toHaveLength(2);
    });

    it("excludes archived cycles by default", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);
      const cycle = await createTestExamCycle(student._id, user._id);
      cycle.archivedAt = new Date();
      await cycle.save();

      const res = await request(app)
        .get(`/api/exam-cycles/student/${student._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.cycles).toHaveLength(0);
    });

    it("includes archived when ?includeArchived=true", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);
      const cycle = await createTestExamCycle(student._id, user._id);
      cycle.archivedAt = new Date();
      await cycle.save();

      const res = await request(app)
        .get(
          `/api/exam-cycles/student/${student._id}?includeArchived=true`,
        )
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.cycles).toHaveLength(1);
    });
  });

  // ─── POST /api/exam-cycles/:cycleId/complete ──────────────
  describe("POST /api/exam-cycles/:cycleId/complete", () => {
    it("completes a cycle and clears activeExamCycleId", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);
      const cycle = await createTestExamCycle(student._id, user._id);

      await Student.findByIdAndUpdate(student._id, {
        activeExamCycleId: cycle._id,
      });

      const res = await request(app)
        .post(`/api/exam-cycles/${cycle._id}/complete`)
        .set("Authorization", `Bearer ${token}`)
        .send({ examTaken: true, closingNote: "Well done" });

      expect(res.status).toBe(200);
      expect(res.body.cycle.status).toBe("completed");

      const updated = await Student.findById(student._id);
      expect(updated.activeExamCycleId).toBeNull();
    });
  });

  // ─── POST /api/exam-cycles/:cycleId/withdraw ──────────────
  describe("POST /api/exam-cycles/:cycleId/withdraw", () => {
    it("withdraws a cycle with reason", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);
      const cycle = await createTestExamCycle(student._id, user._id);

      const res = await request(app)
        .post(`/api/exam-cycles/${cycle._id}/withdraw`)
        .set("Authorization", `Bearer ${token}`)
        .send({ withdrawalReason: "Student moved away" });

      expect(res.status).toBe(200);
      expect(res.body.cycle.status).toBe("withdrawn");
      expect(res.body.cycle.withdrawalReason).toBe("Student moved away");
    });
  });

  // ─── DELETE /api/exam-cycles/:cycleId ──────────────────────
  describe("DELETE /api/exam-cycles/:cycleId", () => {
    it("archives the cycle", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);
      const cycle = await createTestExamCycle(student._id, user._id);

      const res = await request(app)
        .delete(`/api/exam-cycles/${cycle._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it("logs ARCHIVE_EXAM_CYCLE audit event", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);
      const cycle = await createTestExamCycle(student._id, user._id);

      await request(app)
        .delete(`/api/exam-cycles/${cycle._id}`)
        .set("Authorization", `Bearer ${token}`);

      const log = await AuditLog.findOne({
        action: "ARCHIVE_EXAM_CYCLE",
      });
      expect(log).toBeDefined();
      expect(log.actorUserId.toString()).toBe(user._id.toString());
    });
  });

  // ─── Schema maxlength enforcement ──────────────────────────
  describe("maxlength validation", () => {
    it("rejects examLocation longer than 200 chars", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);

      const res = await request(app)
        .post("/api/exam-cycles")
        .set("Authorization", `Bearer ${token}`)
        .send({
          studentId: student._id.toString(),
          instrument: "Piano",
          examType: "Practical",
          examGrade: 3,
          examLocation: "X".repeat(201),
        });

      expect(res.status).toBe(400);
    });

    it("rejects withdrawalReason longer than 500 chars", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);
      const cycle = await createTestExamCycle(student._id, user._id);

      const res = await request(app)
        .post(`/api/exam-cycles/${cycle._id}/withdraw`)
        .set("Authorization", `Bearer ${token}`)
        .send({ withdrawalReason: "X".repeat(501) });

      expect(res.status).toBe(400);
    });

    it("rejects closingNote longer than 1000 chars", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);
      const cycle = await createTestExamCycle(student._id, user._id);

      const res = await request(app)
        .post(`/api/exam-cycles/${cycle._id}/complete`)
        .set("Authorization", `Bearer ${token}`)
        .send({ closingNote: "X".repeat(1001) });

      expect(res.status).toBe(400);
    });
  });
});
