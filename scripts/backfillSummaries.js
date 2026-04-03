import mongoose from "mongoose";
import Student from "../src/models/Student.js";
import { recomputeStudentReadModels } from "../src/services/summary.service.js";

await mongoose.connect(process.env.MONGODB_URI);

const students = await Student.find({}).select("_id").lean();
console.log(`Backfilling ${students.length} students...`);

for (const s of students) {
  await recomputeStudentReadModels(s._id);
  console.log(`✓ ${s._id}`);
}

console.log("Done.");
process.exit(0);
