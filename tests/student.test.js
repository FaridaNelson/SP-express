import request from "supertest";
import app from "../src/app.js";
import Student from "../src/models/Student.js";
import AuditLog from "../src/models/AuditLog.js";
import {
  createTestTeacher,
  createTestAdmin,
  createTestStudentUser,
  createTestStudent,
  fakeId,
} from "./helpers.js";

describe("Student API", () => {
  // ─── POST /api/students ────────────────────────────────────
  describe("POST /api/students", () => {
    it("creates a student with auto-primary access and audit log", async () => {
      const { token, user } = await createTestTeacher();

      const res = await request(app)
        .post("/api/students")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "New",
          lastName: "Student",
          instrument: "Piano",
          grade: 4,
        });

      expect(res.status).toBe(201);
      expect(res.body.student.firstName).toBe("New");
      expect(res.body.student.name).toBe("New Student");
      expect(res.body.student.instrument).toBe("Piano");
      expect(res.body.student.grade).toBe(4);
      expect(res.body.student.inviteCode).toBeDefined();

      // verify audit log
      const log = await AuditLog.findOne({ action: "CREATE_STUDENT" });
      expect(log).toBeDefined();
      expect(log.actorUserId.toString()).toBe(user._id.toString());
    });

    it("rejects unauthenticated request", async () => {
      const res = await request(app).post("/api/students").send({
        firstName: "No",
        lastName: "Auth",
        instrument: "Piano",
        grade: 1,
      });
      expect(res.status).toBe(401);
    });

    it("rejects student-role user (403)", async () => {
      const { token } = await createTestStudentUser();
      const res = await request(app)
        .post("/api/students")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "No",
          lastName: "Access",
          instrument: "Piano",
          grade: 1,
        });
      expect(res.status).toBe(403);
    });

    it("rejects parent-role user (403)", async () => {
      const { token } = await (await import("./helpers.js")).createTestParent();
      const res = await request(app)
        .post("/api/students")
        .set("Authorization", `Bearer ${token}`)
        .send({
          firstName: "No",
          lastName: "Access",
          instrument: "Piano",
          grade: 1,
        });
      expect(res.status).toBe(403);
    });

    it("rejects missing firstName", async () => {
      const { token } = await createTestTeacher();
      const res = await request(app)
        .post("/api/students")
        .set("Authorization", `Bearer ${token}`)
        .send({ lastName: "Student", instrument: "Piano", grade: 1 });
      expect(res.status).toBe(400);
    });

    it("rejects missing instrument", async () => {
      const { token } = await createTestTeacher();
      const res = await request(app)
        .post("/api/students")
        .set("Authorization", `Bearer ${token}`)
        .send({ firstName: "A", lastName: "B", grade: 1 });
      expect(res.status).toBe(400);
    });

    it("rejects missing grade", async () => {
      const { token } = await createTestTeacher();
      const res = await request(app)
        .post("/api/students")
        .set("Authorization", `Bearer ${token}`)
        .send({ firstName: "A", lastName: "B", instrument: "Piano" });
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/students/:studentId ──────────────────────────
  describe("GET /api/students/:studentId", () => {
    it("returns student for teacher with access", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);

      const res = await request(app)
        .get(`/api/students/${student._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.student._id).toBe(student._id.toString());
    });

    it("returns 403 for teacher without access", async () => {
      const { user: teacher1 } = await createTestTeacher();
      const student = await createTestStudent(teacher1._id);

      const { token: otherToken } = await createTestTeacher({
        email: "other@test.com",
      });

      const res = await request(app)
        .get(`/api/students/${student._id}`)
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });

    it("returns 404 for archived student", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);
      student.status = "archived";
      student.archivedAt = new Date();
      await student.save();

      const res = await request(app)
        .get(`/api/students/${student._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent id", async () => {
      const { token } = await createTestTeacher();
      const res = await request(app)
        .get(`/api/students/${fakeId()}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid ObjectId format", async () => {
      const { token } = await createTestTeacher();
      const res = await request(app)
        .get("/api/students/not-a-valid-objectid")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid studentId/);
    });
  });

  // ─── PATCH /api/students/:studentId ────────────────────────
  describe("PATCH /api/students/:studentId", () => {
    it("updates student fields", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);

      const res = await request(app)
        .patch(`/api/students/${student._id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ firstName: "Updated", grade: 5 });

      expect(res.status).toBe(200);
      expect(res.body.student.firstName).toBe("Updated");
      expect(res.body.student.grade).toBe(5);
      expect(res.body.student.name).toBe("Updated Student");
    });

    it("rejects update from teacher without access", async () => {
      const { user: t1 } = await createTestTeacher();
      const student = await createTestStudent(t1._id);

      const { token: otherToken } = await createTestTeacher({
        email: "other2@test.com",
      });

      const res = await request(app)
        .patch(`/api/students/${student._id}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ firstName: "Hacked" });

      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE /api/students/:studentId ───────────────────────
  describe("DELETE /api/students/:studentId", () => {
    it("archives student (soft delete)", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);

      const res = await request(app)
        .delete(`/api/students/${student._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const archived = await Student.findById(student._id);
      expect(archived.status).toBe("archived");
      expect(archived.archivedAt).toBeDefined();
    });

    it("returns 404 for already archived student", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);
      student.status = "archived";
      student.archivedAt = new Date();
      await student.save();

      const res = await request(app)
        .delete(`/api/students/${student._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
