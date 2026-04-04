// src/models/AuditLog.js
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    actorRoles: {
      type: [String],
      default: [],
    },

    action: {
      type: String,
      required: true,
      index: true,
    },

    targetType: {
      type: String,
      enum: [
        "User",
        "Student",
        "Lesson",
        "ScoreEntry",
        "ExamPreparationCycle",
        "TeacherStudentAccess",
      ],
      required: true,
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ipAddress: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Auto-expire logs after 2 years (optional, for GDPR compliance)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

export default mongoose.model("AuditLog", auditLogSchema);
