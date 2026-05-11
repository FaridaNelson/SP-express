import mongoose from "mongoose";
import dotenv from "dotenv";
import ScoreEntry from "../src/models/ScoreEntry.js";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");

await mongoose.connect(process.env.MONGODB_URI);

const duplicates = await ScoreEntry.aggregate([
  {
    $group: {
      _id: {
        createdByTeacherId: "$createdByTeacherId",
        studentId: "$studentId",
        examPreparationCycleId: "$examPreparationCycleId",
        instrument: "$instrument",
        lessonDate: "$lessonDate",
        elementId: "$elementId",
      },
      count: { $sum: 1 },
      docs: {
        $push: {
          _id: "$_id",
          score: "$score",
          createdAt: "$createdAt",
          updatedAt: "$updatedAt",
        },
      },
    },
  },
  {
    $match: {
      count: { $gt: 1 },
    },
  },
]);

let totalToDelete = 0;

for (const group of duplicates) {
  const sortedDocs = group.docs.sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt);
    const dateB = new Date(b.updatedAt || b.createdAt);
    return dateB - dateA;
  });

  const keep = sortedDocs[0];
  const remove = sortedDocs.slice(1);

  totalToDelete += remove.length;

  console.log("\nDuplicate group:", group._id);
  console.log("Keeping:", keep);
  console.log(
    "Deleting:",
    remove.map((doc) => doc._id),
  );

  if (!DRY_RUN) {
    await ScoreEntry.deleteMany({
      _id: { $in: remove.map((doc) => doc._id) },
    });
  }
}

console.log("\nSummary:");
console.log(`Duplicate groups found: ${duplicates.length}`);
console.log(
  DRY_RUN
    ? `Dry run complete. Would delete ${totalToDelete} documents.`
    : `Cleanup complete. Deleted ${totalToDelete} documents.`,
);

await mongoose.disconnect();
