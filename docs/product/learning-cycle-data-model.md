Create a new generic model:

** LearningCycle **

and later let ABRSM exam cycles become one type of learning cycle.

Do not immediately delete or replace ExamCycle. Safer path:

Current ExamCycle stays working
↓
New LearningCycle model is added
↓
Custom cycles use LearningCycle first
↓
ABRSM can migrate later if needed
First draft schema
const learningCycleSchema = new mongoose.Schema(
{
studentId: {
type: mongoose.Schema.Types.ObjectId,
ref: "Student",
required: true,
},

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    cycleType: {
      type: String,
      enum: ["custom", "exam", "repertoire", "technique", "recital"],
      default: "custom",
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
    },

    startDate: {
      type: Date,
      required: true,
    },

    targetEndDate: {
      type: Date,
      default: null,
    },

    goals: [
      {
        title: String,
        description: String,
        priority: {
          type: String,
          enum: ["low", "medium", "high"],
          default: "medium",
        },
      },
    ],

    focusAreas: [
      {
        type: String,
        enum: [
          "repertoire",
          "technique",
          "sightReading",
          "aural",
          "theory",
          "improvisation",
          "composition",
          "musicality",
          "practiceHabits",
          "performancePrep",
          "custom",
        ],
      },
    ],

    repertoire: [
      {
        title: String,
        composer: String,
        arrangementLevel: String,
        status: {
          type: String,
          enum: ["planned", "inProgress", "paused", "completed"],
          default: "planned",
        },
        notes: String,
      },
    ],

    tasks: [
      {
        title: {
          type: String,
          required: true,
        },
        category: {
          type: String,
          default: "custom",
        },
        description: {
          type: String,
          default: "",
        },
        isActive: {
          type: Boolean,
          default: true,
        },
      },
    ],

    sourceExamCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamCycle",
      default: null,
    },

},
{ timestamps: true }
);

// For Ethan(Farida), June-August 2026,
// This would support:

{
cycleType: "repertoire",
title: "Post-ABRSM Repertoire Exploration",
goals: [
{ title: "Explore expressive piano repertoire" },
{ title: "Build hand span and broken chord technique" }
],
focusAreas: ["repertoire", "technique", "musicality", "practiceHabits"],
repertoire: [
{ title: "Kiss the Rain", composer: "Yiruma", arrangementLevel: "simplified" },
{ title: "Moonlight Sonata", composer: "Beethoven", arrangementLevel: "excerpt/adapted" }
],
sourceExamCycleId: "previous ABRSM cycle id"
}

## Update 2026-06-24:

Lesson documents now store instructional metadata per piece:

- tempo note value
- target tempo
- achieved tempo
- practice time during lesson
- homework

This separates instructional information from long-term exam preparation data.
