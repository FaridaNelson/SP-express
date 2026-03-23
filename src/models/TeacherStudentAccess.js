import mongoose from "mongoose";

const teacherStudentAccessSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    instrument: {
      type: String,
      required: true,
      enum: ["Piano", "Voice", "Guitar"],
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "revoked"],
      required: true,
      default: "active",
      index: true,
    },

    role: {
      type: String,
      enum: ["primary", "collaborator", "viewer"],
      required: true,
      default: "primary",
      index: true,
    },

    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    endedAt: {
      type: Date,
      default: null,
      index: true,
    },

    grantedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    revokedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true },
);

// one teacher should not have multiple active rows for same student+instrument
teacherStudentAccessSchema.index(
  { studentId: 1, teacherId: 1, instrument: 1, status: 1 },
  {
    partialFilterExpression: { status: "active" },
    unique: true,
  },
);

// only one active primary teacher per student+instrument
teacherStudentAccessSchema.index(
  { studentId: 1, instrument: 1, role: 1, status: 1 },
  {
    partialFilterExpression: { role: "primary", status: "active" },
    unique: true,
  },
);

teacherStudentAccessSchema.index({
  teacherId: 1,
  instrument: 1,
  status: 1,
  role: 1,
});

teacherStudentAccessSchema.index({
  studentId: 1,
  instrument: 1,
  status: 1,
  role: 1,
});

teacherStudentAccessSchema.index({
  teacherId: 1,
  studentId: 1,
  instrument: 1,
  startedAt: -1,
});

teacherStudentAccessSchema.index({
  studentId: 1,
  startedAt: -1,
});

export default mongoose.models.TeacherStudentAccess ||
  mongoose.model("TeacherStudentAccess", teacherStudentAccessSchema);
