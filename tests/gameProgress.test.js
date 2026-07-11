import request from "supertest";
import app from "../src/app.js";
import GameProgress from "../src/models/GameProgress.js";
import {
  createTestStudent,
  createTestStudentUser,
  createTestTeacher,
  fakeId,
} from "./helpers.js";

async function csrfAgent() {
  const agent = request.agent(app);
  const res = await agent.get("/api/csrf-token");
  return { agent, token: res.body.csrfToken };
}

function sessionPayload(overrides = {}) {
  return {
    session: {
      score: 8,
      correct: 8,
      incorrect: 2,
      duration: 60,
      mode: "timed",
      timerMinutes: 1,
      endedBy: "timer",
      completedAt: "2026-07-11T16:00:00.000Z",
      ...overrides,
    },
    cumulativeStats: {
      C4: { seen: 5, wrong: 1 },
      D4: { seen: 5, wrong: 1 },
    },
  };
}

describe("GameProgress API", () => {
  async function createLinkedStudent() {
    const { user: teacher } = await createTestTeacher();
    const { user: studentUser, token } = await createTestStudentUser();
    const student = await createTestStudent(teacher._id, {
      email: "linked-game-student@test.com",
      studentUserId: studentUser._id,
    });

    return { student, studentUser, token };
  }

  async function postSession(token, body) {
    const { agent, token: csrfToken } = await csrfAgent();

    return agent
      .post("/api/game-progress/me/note-detective/session")
      .set("Authorization", `Bearer ${token}`)
      .set("X-CSRF-Token", csrfToken)
      .send(body);
  }

  describe("GET /api/game-progress/me/:appId", () => {
    it("rejects unauthenticated access", async () => {
      const res = await request(app).get("/api/game-progress/me/note-detective");

      expect(res.status).toBe(401);
    });

    it("rejects invalid appId", async () => {
      const { token } = await createLinkedStudent();

      const res = await request(app)
        .get("/api/game-progress/me/rhythm-detective")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid appId/);
    });

    it("returns 404 when the student user has no linked Student", async () => {
      const { token } = await createTestStudentUser();

      const res = await request(app)
        .get("/api/game-progress/me/note-detective")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Linked student not found");
    });

    it("returns only the authenticated student's progress", async () => {
      const linked = await createLinkedStudent();
      const other = await createLinkedStudent();

      await GameProgress.create({
        studentId: linked.student._id,
        appId: "note-detective",
        sessions: [{ score: 10, correct: 10, incorrect: 0 }],
      });
      await GameProgress.create({
        studentId: other.student._id,
        appId: "note-detective",
        sessions: [{ score: 1, correct: 1, incorrect: 9 }],
      });

      const res = await request(app)
        .get("/api/game-progress/me/note-detective")
        .set("Authorization", `Bearer ${linked.token}`);

      expect(res.status).toBe(200);
      expect(res.body.gameProgress.studentId).toBe(
        linked.student._id.toString(),
      );
      expect(res.body.gameProgress.sessions).toHaveLength(1);
      expect(res.body.gameProgress.sessions[0].score).toBe(10);
    });
  });

  describe("POST /api/game-progress/me/:appId/session", () => {
    it("rejects unauthenticated access", async () => {
      const { agent, token: csrfToken } = await csrfAgent();

      const res = await agent
        .post("/api/game-progress/me/note-detective/session")
        .set("X-CSRF-Token", csrfToken)
        .send(sessionPayload());

      expect(res.status).toBe(401);
    });

    it("rejects invalid appId", async () => {
      const { token } = await createLinkedStudent();
      const { agent, token: csrfToken } = await csrfAgent();

      const res = await agent
        .post("/api/game-progress/me/rhythm-detective/session")
        .set("Authorization", `Bearer ${token}`)
        .set("X-CSRF-Token", csrfToken)
        .send(sessionPayload());

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid appId/);
    });

    it("returns 404 when the student user has no linked Student", async () => {
      const { token } = await createTestStudentUser();
      const { agent, token: csrfToken } = await csrfAgent();

      const res = await agent
        .post("/api/game-progress/me/note-detective/session")
        .set("Authorization", `Bearer ${token}`)
        .set("X-CSRF-Token", csrfToken)
        .send(sessionPayload());

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Linked student not found");
    });

    it("creates the first progress record for the linked student", async () => {
      const { student, token } = await createLinkedStudent();
      const { agent, token: csrfToken } = await csrfAgent();

      const res = await agent
        .post("/api/game-progress/me/note-detective/session")
        .set("Authorization", `Bearer ${token}`)
        .set("X-CSRF-Token", csrfToken)
        .send(sessionPayload());

      expect(res.status).toBe(201);
      expect(res.body.gameProgress.studentId).toBe(student._id.toString());
      expect(res.body.gameProgress.appId).toBe("note-detective");
      expect(res.body.gameProgress.appType).toBe("game");
      expect(res.body.gameProgress.sessions).toHaveLength(1);
      expect(res.body.gameProgress.sessions[0].score).toBe(8);
      expect(res.body.gameProgress.cumulativeStats.C4.seen).toBe(5);
    });

    it("appends another session to the same progress record", async () => {
      const { token } = await createLinkedStudent();

      await postSession(token, sessionPayload({ score: 8 }));

      const res = await postSession(
        token,
        sessionPayload({ score: 12, correct: 12, incorrect: 0 }),
      );

      expect(res.status).toBe(201);
      expect(res.body.gameProgress.sessions).toHaveLength(2);
      expect(res.body.gameProgress.sessions[1].score).toBe(12);

      const records = await GameProgress.find({ appId: "note-detective" });
      expect(records).toHaveLength(1);
    });

    it("preserves other cumulativeStats entries on partial note update", async () => {
      const { student, token } = await createLinkedStudent();

      await GameProgress.create({
        studentId: student._id,
        appId: "note-detective",
        cumulativeStats: {
          C4: { seen: 5, wrong: 2 },
          D4: { seen: 9, wrong: 1 },
        },
      });

      const res = await postSession(token, {
        ...sessionPayload({ score: 9 }),
        cumulativeStats: {
          C4: { seen: 7 },
        },
      });

      expect(res.status).toBe(201);

      const updated = await GameProgress.findOne({
        studentId: student._id,
        appId: "note-detective",
      });

      expect(updated.cumulativeStats.get("C4").seen).toBe(7);
      expect(updated.cumulativeStats.get("C4").wrong).toBe(2);
      expect(updated.cumulativeStats.get("D4").seen).toBe(9);
      expect(updated.cumulativeStats.get("D4").wrong).toBe(1);
    });

    it("preserves unspecified cycleContext fields on partial update", async () => {
      const { student, token } = await createLinkedStudent();
      const examCycleId = fakeId();
      const learningCycleId = fakeId();

      await GameProgress.create({
        studentId: student._id,
        appId: "note-detective",
        cycleContext: {
          cycleType: "exam",
          examCycleId,
          learningCycleId,
        },
      });

      const res = await postSession(token, {
        ...sessionPayload({ score: 9 }),
        cycleContext: {
          cycleType: "none",
        },
      });

      expect(res.status).toBe(201);

      const updated = await GameProgress.findOne({
        studentId: student._id,
        appId: "note-detective",
      }).lean();

      expect(updated.cycleContext.cycleType).toBe("none");
      expect(updated.cycleContext.examCycleId.toString()).toBe(examCycleId);
      expect(updated.cycleContext.learningCycleId.toString()).toBe(
        learningCycleId,
      );
    });

    it("rejects negative counts", async () => {
      const { token } = await createLinkedStudent();

      const negativeCorrect = await postSession(
        token,
        sessionPayload({ correct: -1 }),
      );
      expect(negativeCorrect.status).toBe(400);

      const negativeSeen = await postSession(token, {
        ...sessionPayload({ score: 9 }),
        cumulativeStats: {
          C4: { seen: -1 },
        },
      });
      expect(negativeSeen.status).toBe(400);
    });

    it("rejects decimal correct and incorrect values", async () => {
      const { token } = await createLinkedStudent();

      const decimalCorrect = await postSession(
        token,
        sessionPayload({ correct: 1.5 }),
      );
      expect(decimalCorrect.status).toBe(400);

      const decimalIncorrect = await postSession(
        token,
        sessionPayload({ incorrect: 0.5 }),
      );
      expect(decimalIncorrect.status).toBe(400);
    });

    it("rejects invalid ObjectIds in cycleContext", async () => {
      const { token } = await createLinkedStudent();

      const invalidExamCycle = await postSession(token, {
        ...sessionPayload({ score: 9 }),
        cycleContext: {
          examCycleId: "not-an-objectid",
        },
      });
      expect(invalidExamCycle.status).toBe(400);

      const invalidLearningCycle = await postSession(token, {
        ...sessionPayload({ score: 9 }),
        cycleContext: {
          learningCycleId: "not-an-objectid",
        },
      });
      expect(invalidLearningCycle.status).toBe(400);
    });

    it("rejects unsafe cumulativeStats keys", async () => {
      const { token } = await createLinkedStudent();

      const dottedKey = await postSession(token, {
        ...sessionPayload({ score: 9 }),
        cumulativeStats: {
          "C4.bad": { seen: 1 },
        },
      });
      expect(dottedKey.status).toBe(400);

      const dollarKey = await postSession(token, {
        ...sessionPayload({ score: 9 }),
        cumulativeStats: {
          $C4: { seen: 1 },
        },
      });
      expect(dollarKey.status).toBe(400);
    });

    it("rejects an empty session", async () => {
      const { token } = await createLinkedStudent();

      const res = await postSession(token, {
        session: {},
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("session must include progress fields");
    });
  });
});
