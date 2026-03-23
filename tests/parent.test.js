import request from "supertest";
import app from "../src/app.js";
import Student from "../src/models/Student.js";
import AuditLog from "../src/models/AuditLog.js";
import {
  createTestTeacher,
  createTestAdmin,
  createTestParent,
  createTestStudent,
  fakeId,
} from "./helpers.js";

describe("Parent API", () => {
  // ─── GET /api/parent/students ──────────────────────────────
  describe("GET /api/parent/students", () => {
    it("returns only parent's linked students", async () => {
      const { token: parentToken, user: parent } = await createTestParent();
      const { user: teacher } = await createTestTeacher();

      const linked = await createTestStudent(teacher._id, {
        email: "linked@test.com",
      });
      await Student.findByIdAndUpdate(linked._id, {
        $addToSet: { parentIds: parent._id },
      });

      // create an unlinked student
      await createTestStudent(teacher._id, { email: "unlinked@test.com" });

      const res = await request(app)
        .get("/api/parent/students")
        .set("Authorization", `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.students).toHaveLength(1);
      expect(res.body.students[0]._id).toBe(linked._id.toString());
    });

    it("admin sees all students", async () => {
      const { token: adminToken } = await createTestAdmin();
      const { user: teacher } = await createTestTeacher();
      await createTestStudent(teacher._id, { email: "s1@test.com" });
      await createTestStudent(teacher._id, { email: "s2@test.com" });

      const res = await request(app)
        .get("/api/parent/students")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.students).toHaveLength(2);
    });

    it("logs audit event when admin accesses parent-scoped data", async () => {
      const { token: adminToken } = await createTestAdmin();
      const { user: teacher } = await createTestTeacher();
      await createTestStudent(teacher._id);

      await request(app)
        .get("/api/parent/students")
        .set("Authorization", `Bearer ${adminToken}`);

      const log = await AuditLog.findOne({
        action: "ADMIN_LIST_ALL_STUDENTS",
      });
      expect(log).toBeDefined();
      expect(log.metadata.adminBypass).toBe(true);
    });

    it("rejects teacher role (403)", async () => {
      const { token } = await createTestTeacher();
      const res = await request(app)
        .get("/api/parent/students")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it("rejects unauthenticated (401)", async () => {
      const res = await request(app).get("/api/parent/students");
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/parent/students/:id/progress ─────────────────
  describe("GET /api/parent/students/:id/progress", () => {
    it("returns progress items for linked student", async () => {
      const { token: parentToken, user: parent } = await createTestParent();
      const { user: teacher } = await createTestTeacher();
      const student = await createTestStudent(teacher._id);
      await Student.findByIdAndUpdate(student._id, {
        $addToSet: { parentIds: parent._id },
      });

      const res = await request(app)
        .get(`/api/parent/students/${student._id}/progress`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it("returns 404 for unlinked student", async () => {
      const { token: parentToken } = await createTestParent();
      const { user: teacher } = await createTestTeacher();
      const student = await createTestStudent(teacher._id);

      const res = await request(app)
        .get(`/api/parent/students/${student._id}/progress`)
        .set("Authorization", `Bearer ${parentToken}`);

      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent student", async () => {
      const { token: parentToken } = await createTestParent();
      const res = await request(app)
        .get(`/api/parent/students/${fakeId()}/progress`)
        .set("Authorization", `Bearer ${parentToken}`);
      expect(res.status).toBe(404);
    });
  });
});
