import request from "supertest";
import app from "../src/app.js";
import Lesson from "../src/models/Lesson.js";
import {
  createTestTeacher,
  createTestStudent,
  createTestExamCycle,
  fakeId,
} from "./helpers.js";

describe("Lesson API", () => {
  let teacher, token, student, cycle;

  beforeEach(async () => {
    const t = await createTestTeacher();
    teacher = t.user;
    token = t.token;
    student = await createTestStudent(teacher._id);
    cycle = await createTestExamCycle(student._id, teacher._id);
  });

  const validLesson = () => ({
    studentId: student._id.toString(),
    examPreparationCycleId: cycle._id.toString(),
    instrument: "Piano",
    lessonDate: "2026-03-20",
    lessonStartAt: "2026-03-20T10:00:00Z",
    lessonEndAt: "2026-03-20T11:00:00Z",
  });

  // ─── PUT /api/lessons (upsert) ─────────────────────────────
  describe("PUT /api/lessons", () => {
    it("creates a new lesson", async () => {
      const res = await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send(validLesson());

      expect(res.status).toBe(200);
      expect(res.body.lesson).toBeDefined();
      expect(res.body.lesson.instrument).toBe("Piano");
    });

    it("upserts (updates) on same key fields", async () => {
      const body = validLesson();
      await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      const res = await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send({ ...body, teacherNarrative: "Updated note" });

      expect(res.status).toBe(200);
      expect(res.body.lesson.teacherNarrative).toBe("Updated note");

      // should still be only 1 lesson
      const count = await Lesson.countDocuments({});
      expect(count).toBe(1);
    });

    it("rejects missing required fields", async () => {
      const res = await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send({ instrument: "Piano" });

      expect(res.status).toBe(400);
    });

    it("rejects lessonEndAt before lessonStartAt", async () => {
      const body = validLesson();
      body.lessonEndAt = "2026-03-20T09:00:00Z"; // before start

      const res = await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/lessonEndAt/);
    });

    it("rejects invalid lessonDate", async () => {
      const body = validLesson();
      body.lessonDate = "not-a-date";

      const res = await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      expect(res.status).toBe(400);
    });

    it("rejects cycle that doesn't belong to student", async () => {
      const { user: other } = await createTestTeacher({
        email: "other-lesson@test.com",
      });
      const otherStudent = await createTestStudent(other._id, {
        email: "other-student@test.com",
      });
      const otherCycle = await createTestExamCycle(
        otherStudent._id,
        other._id,
      );

      const body = validLesson();
      body.examPreparationCycleId = otherCycle._id.toString();

      const res = await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/does not belong/);
    });

    it("rejects instrument mismatch with cycle", async () => {
      // cycle is Piano, try Guitar
      const body = validLesson();
      body.instrument = "Guitar";

      const res = await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send(body);

      // will fail on access check first (no Guitar access)
      expect(res.status).toBe(403);
    });

    it("rejects teacher without edit access", async () => {
      const { token: noAccessToken } = await createTestTeacher({
        email: "no-access-lesson@test.com",
      });

      const res = await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${noAccessToken}`)
        .send(validLesson());

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/lessons/:lessonId (BOLA) ─────────────────────
  describe("GET /api/lessons/:lessonId", () => {
    it("returns lesson for authorized teacher", async () => {
      const createRes = await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send(validLesson());

      const lessonId = createRes.body.lesson._id;

      const res = await request(app)
        .get(`/api/lessons/${lessonId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.lesson._id).toBe(lessonId);
    });

    it("returns 404 (not 403) for unauthorized teacher — BOLA", async () => {
      const createRes = await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send(validLesson());

      const lessonId = createRes.body.lesson._id;

      const { token: otherToken } = await createTestTeacher({
        email: "bola-lesson@test.com",
      });

      const res = await request(app)
        .get(`/api/lessons/${lessonId}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent lesson", async () => {
      const res = await request(app)
        .get(`/api/lessons/${fakeId()}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/lessons/student/:studentId ───────────────────
  describe("GET /api/lessons/student/:studentId", () => {
    it("lists lessons for student", async () => {
      await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send(validLesson());

      const res = await request(app)
        .get(`/api/lessons/student/${student._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.lessons).toHaveLength(1);
    });

    it("rejects invalid instrument enum in query param", async () => {
      const res = await request(app)
        .get(`/api/lessons/student/${student._id}?instrument=Drums`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid instrument/);
    });

    it("filters lessons by cycleId query param", async () => {
      const cycleA = cycle;
      const cycleB = await createTestExamCycle(student._id, teacher._id, {
        examGrade: 4,
      });

      // 2 lessons for cycleA
      await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          ...validLesson(),
          examPreparationCycleId: cycleA._id.toString(),
          lessonStartAt: "2026-03-20T10:00:00Z",
        });
      await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          ...validLesson(),
          examPreparationCycleId: cycleA._id.toString(),
          lessonDate: "2026-03-21",
          lessonStartAt: "2026-03-21T10:00:00Z",
          lessonEndAt: "2026-03-21T11:00:00Z",
        });

      // 1 lesson for cycleB
      await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send({
          ...validLesson(),
          examPreparationCycleId: cycleB._id.toString(),
          lessonDate: "2026-03-22",
          lessonStartAt: "2026-03-22T10:00:00Z",
          lessonEndAt: "2026-03-22T11:00:00Z",
        });

      const res = await request(app)
        .get(`/api/lessons/student/${student._id}?cycleId=${cycleA._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.lessons).toHaveLength(2);
      for (const lesson of res.body.lessons) {
        expect(lesson.examPreparationCycleId).toBe(cycleA._id.toString());
      }
    });

    it("returns 400 for invalid cycleId", async () => {
      const res = await request(app)
        .get(`/api/lessons/student/${student._id}?cycleId=not-a-valid-objectid`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid cycleId/);
    });

    it("excludes archived lessons", async () => {
      const createRes = await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send(validLesson());

      const lesson = await Lesson.findById(createRes.body.lesson._id);
      lesson.archivedAt = new Date();
      await lesson.save();

      const res = await request(app)
        .get(`/api/lessons/student/${student._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.body.lessons).toHaveLength(0);
    });
  });

  // ─── GET /api/lessons/student/:studentId/latest ────────────
  describe("GET /api/lessons/student/:studentId/latest", () => {
    it("returns latest lesson or null", async () => {
      const res = await request(app)
        .get(`/api/lessons/student/${student._id}/latest`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.lesson).toBeNull();
    });
  });

  // ─── DELETE /api/lessons/:lessonId ─────────────────────────
  describe("DELETE /api/lessons/:lessonId", () => {
    it("archives a lesson (soft delete)", async () => {
      const createRes = await request(app)
        .put("/api/lessons")
        .set("Authorization", `Bearer ${token}`)
        .send(validLesson());

      const lessonId = createRes.body.lesson._id;

      const res = await request(app)
        .delete(`/api/lessons/${lessonId}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const archived = await Lesson.findById(lessonId);
      expect(archived.archivedAt).toBeDefined();
    });
  });
});
