import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";

dotenv.config();

async function migrateNames() {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is missing from .env");
    }

    await mongoose.connect(uri);
    console.log("Connected to DB");

    const users = await User.find({
      $or: [
        { firstName: { $exists: false } },
        { lastName: { $exists: false } },
        { firstName: "" },
        { lastName: "" },
      ],
    });

    console.log(`Users needing migration: ${users.length}`);

    for (const user of users) {
      const rawName = String(user.name || "").trim();
      if (!rawName) continue;

      const parts = rawName.split(/\s+/);
      const firstName = parts.shift() || "User";
      const lastName = parts.join(" ") || firstName;

      if (!user.firstName) user.firstName = firstName;
      if (!user.lastName) user.lastName = lastName;

      await user.save();

      console.log(
        `Updated: ${user.email} -> firstName="${user.firstName}", lastName="${user.lastName}"`,
      );
    }

    console.log("Migration complete");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrateNames();
