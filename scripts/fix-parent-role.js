import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../src/models/User.js";

dotenv.config();

async function fixParentRole() {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is missing from .env");
    }

    await mongoose.connect(uri);
    console.log("Connected to DB");

    const result = await User.updateOne(
      { name: /Indupriya Palenkonta/i },
      { $addToSet: { roles: "parent" } },
    );

    console.log("Update result:", result);

    const user = await User.findOne(
      { name: /Indupriya Palenkonta/i },
    ).select("name roles");

    if (user) {
      console.log(`Verified: ${user.name} -> roles: [${user.roles.join(", ")}]`);
    } else {
      console.log("User not found — check the name");
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixParentRole();
