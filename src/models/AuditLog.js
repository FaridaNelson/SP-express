// src/models/AuditLog.js
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "CREATE_STUDENT",
        "EDIT_STUDENT",
        "DELETE_STUDENT",
        "ASSIGN_CURRICULUM",
        "CHANGE_GRADE",
        "CHANGE_INSTRUMENT",
        "CREATE_CURRICULUM_SET",
        "ACTIVATE_CURRICULUM_SET",
        "RETIRE_CURRICULUM_SET",
        "IMPORT_CURRICULUM_TEMPLATE",
        "EDIT_CURRICULUM_TEMPLATE",
        "RECORD_EXAM_RESULT",
      ],
    },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    targetStudentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    metadata: { type: mongoose.Schema.Types.Mixed }, // flexible JSON
    ipAddress: String,
    userAgent: String,
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

// Auto-expire logs after 2 years (optional, for GDPR compliance)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

export default mongoose.model("AuditLog", auditLogSchema);
