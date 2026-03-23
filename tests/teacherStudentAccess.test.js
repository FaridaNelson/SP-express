import request from "supertest";
import app from "../src/app.js";
import TeacherStudentAccess from "../src/models/TeacherStudentAccess.js";
import AuditLog from "../src/models/AuditLog.js";
import {
  createTestTeacher,
  createTestAdmin,
  createTestStudent,
  fakeId,
} from "./helpers.js";

describe("Teacher Student Access API", () => {
  // ─── POST /student/:studentId/primary ──────────────────────
  describe("POST /api/teacher-student-access/student/:studentId/primary", () => {
    it("assigns a new primary teacher", async () => {
      const { token, user: teacher1 } = await createTestTeacher();
      const student = await createTestStudent(teacher1._id);

      const { user: teacher2 } = await createTestTeacher({
        email: "teacher2@test.com",
      });

      const res = await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/primary`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          teacherId: teacher2._id.toString(),
          instrument: "Piano",
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.access.role).toBe("primary");

      // old primary should be inactive
      const oldAccess = await TeacherStudentAccess.findOne({
        teacherId: teacher1._id,
        studentId: student._id,
        status: "inactive",
      });
      expect(oldAccess).toBeDefined();
      expect(oldAccess.endedAt).toBeDefined();
    });

    it("rejects if not primary teacher or admin", async () => {
      const { user: teacher1 } = await createTestTeacher();
      const student = await createTestStudent(teacher1._id);

      const { token: otherToken, user: teacher2 } = await createTestTeacher({
        email: "not-primary@test.com",
      });

      const { user: teacher3 } = await createTestTeacher({
        email: "teacher3@test.com",
      });

      const res = await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/primary`,
        )
        .set("Authorization", `Bearer ${otherToken}`)
        .send({
          teacherId: teacher3._id.toString(),
          instrument: "Piano",
        });

      expect(res.status).toBe(403);
    });

    it("admin can assign without being primary teacher", async () => {
      const { user: teacher1 } = await createTestTeacher();
      const student = await createTestStudent(teacher1._id);

      const { token: adminToken } = await createTestAdmin();
      const { user: teacher2 } = await createTestTeacher({
        email: "admin-assign@test.com",
      });

      const res = await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/primary`,
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          teacherId: teacher2._id.toString(),
          instrument: "Piano",
        });

      expect(res.status).toBe(200);
    });

    it("rejects invalid ObjectId", async () => {
      const { token } = await createTestTeacher();
      const res = await request(app)
        .post(
          `/api/teacher-student-access/student/not-an-id/primary`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({ teacherId: fakeId(), instrument: "Piano" });

      expect(res.status).toBe(400);
    });

    it("rejects invalid instrument", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);

      const res = await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/primary`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({ teacherId: user._id.toString(), instrument: "Drums" });

      expect(res.status).toBe(400);
    });

    it("rejects assigning teacher who is already primary", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);

      const res = await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/primary`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          teacherId: user._id.toString(),
          instrument: "Piano",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already.*primary/i);
    });

    it("logs ASSIGN_PRIMARY_TEACHER audit event", async () => {
      const { token, user: teacher1 } = await createTestTeacher();
      const student = await createTestStudent(teacher1._id);

      const { user: teacher2 } = await createTestTeacher({
        email: "audit-primary@test.com",
      });

      await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/primary`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          teacherId: teacher2._id.toString(),
          instrument: "Piano",
        });

      const log = await AuditLog.findOne({
        action: "ASSIGN_PRIMARY_TEACHER",
      });
      expect(log).toBeDefined();
    });
  });

  // ─── POST /student/:studentId/access ───────────────────────
  describe("POST /api/teacher-student-access/student/:studentId/access", () => {
    it("adds collaborator access", async () => {
      const { token, user: teacher1 } = await createTestTeacher();
      const student = await createTestStudent(teacher1._id);

      const { user: teacher2 } = await createTestTeacher({
        email: "collab@test.com",
      });

      const res = await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/access`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          teacherId: teacher2._id.toString(),
          instrument: "Piano",
          role: "collaborator",
        });

      expect(res.status).toBe(201);
      expect(res.body.access.role).toBe("collaborator");
    });

    it("adds viewer access", async () => {
      const { token, user: teacher1 } = await createTestTeacher();
      const student = await createTestStudent(teacher1._id);

      const { user: teacher2 } = await createTestTeacher({
        email: "viewer@test.com",
      });

      const res = await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/access`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          teacherId: teacher2._id.toString(),
          instrument: "Piano",
          role: "viewer",
        });

      expect(res.status).toBe(201);
      expect(res.body.access.role).toBe("viewer");
    });

    it("rejects duplicate active access", async () => {
      const { token, user: teacher1 } = await createTestTeacher();
      const student = await createTestStudent(teacher1._id);

      const { user: teacher2 } = await createTestTeacher({
        email: "dupe-access@test.com",
      });

      await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/access`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          teacherId: teacher2._id.toString(),
          instrument: "Piano",
          role: "collaborator",
        });

      const res = await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/access`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          teacherId: teacher2._id.toString(),
          instrument: "Piano",
          role: "viewer",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already has active access/);
    });

    it("rejects role=primary via addTeacherAccess", async () => {
      const { token, user: teacher1 } = await createTestTeacher();
      const student = await createTestStudent(teacher1._id);

      const { user: teacher2 } = await createTestTeacher({
        email: "try-primary@test.com",
      });

      const res = await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/access`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          teacherId: teacher2._id.toString(),
          instrument: "Piano",
          role: "primary",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/collaborator.*viewer/);
    });
  });

  // ─── POST /student/:studentId/access/:accessId/revoke ──────
  describe("POST /api/teacher-student-access/student/:studentId/access/:accessId/revoke", () => {
    it("revokes collaborator access", async () => {
      const { token, user: teacher1 } = await createTestTeacher();
      const student = await createTestStudent(teacher1._id);

      const { user: teacher2 } = await createTestTeacher({
        email: "revoke-target@test.com",
      });

      const addRes = await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/access`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({
          teacherId: teacher2._id.toString(),
          instrument: "Piano",
          role: "collaborator",
        });

      const accessId = addRes.body.access._id;

      const res = await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/access/${accessId}/revoke`,
        )
        .set("Authorization", `Bearer ${token}`)
        .send({ note: "No longer needed" });

      expect(res.status).toBe(200);
      expect(res.body.access.status).toBe("revoked");
      expect(res.body.access.endedAt).toBeDefined();
    });

    it("cannot revoke primary teacher — must reassign instead", async () => {
      const { token, user: teacher } = await createTestTeacher();
      const student = await createTestStudent(teacher._id);

      const primaryAccess = await TeacherStudentAccess.findOne({
        teacherId: teacher._id,
        studentId: student._id,
        role: "primary",
      });

      const res = await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/access/${primaryAccess._id}/revoke`,
        )
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/primary/i);
    });

    it("returns 404 for non-existent access", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);

      const res = await request(app)
        .post(
          `/api/teacher-student-access/student/${student._id}/access/${fakeId()}/revoke`,
        )
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /teacher/:teacherId/students ──────────────────────
  describe("GET /api/teacher-student-access/teacher/:teacherId/students", () => {
    it("lists students for teacher", async () => {
      const { token, user } = await createTestTeacher();
      await createTestStudent(user._id, { email: "s1@test.com" });
      await createTestStudent(user._id, { email: "s2@test.com" });

      const res = await request(app)
        .get(
          `/api/teacher-student-access/teacher/${user._id}/students`,
        )
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.students).toHaveLength(2);
      expect(res.body.students[0].role).toBe("primary");
    });

    it("teacher cannot list another teacher's students", async () => {
      const { user: teacher1 } = await createTestTeacher();
      await createTestStudent(teacher1._id);

      const { token: otherToken } = await createTestTeacher({
        email: "snooper@test.com",
      });

      const res = await request(app)
        .get(
          `/api/teacher-student-access/teacher/${teacher1._id}/students`,
        )
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });

    it("admin can list any teacher's students", async () => {
      const { user: teacher } = await createTestTeacher();
      await createTestStudent(teacher._id);

      const { token: adminToken } = await createTestAdmin();

      const res = await request(app)
        .get(
          `/api/teacher-student-access/teacher/${teacher._id}/students`,
        )
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.students).toHaveLength(1);
    });

    it("validates role query param", async () => {
      const { token, user } = await createTestTeacher();

      const res = await request(app)
        .get(
          `/api/teacher-student-access/teacher/${user._id}/students?role=superadmin`,
        )
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it("validates status query param", async () => {
      const { token, user } = await createTestTeacher();

      const res = await request(app)
        .get(
          `/api/teacher-student-access/teacher/${user._id}/students?status=deleted`,
        )
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /student/:studentId ───────────────────────────────
  describe("GET /api/teacher-student-access/student/:studentId", () => {
    it("lists access rows for student (with instrument)", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);

      const res = await request(app)
        .get(
          `/api/teacher-student-access/student/${student._id}?instrument=Piano`,
        )
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.accessRows).toHaveLength(1);
    });

    it("non-admin without instrument gets 403", async () => {
      const { token, user } = await createTestTeacher();
      const student = await createTestStudent(user._id);

      // teacher2 is not primary, can't list without instrument
      const { token: otherToken } = await createTestTeacher({
        email: "no-instrument@test.com",
      });

      const res = await request(app)
        .get(
          `/api/teacher-student-access/student/${student._id}`,
        )
        .set("Authorization", `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });
});
