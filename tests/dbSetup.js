import mongoose from "mongoose";
import { readFileSync } from "fs";
import { join } from "path";

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    const uri =
      process.env.MONGO_TEST_URI ||
      readFileSync(join(process.cwd(), ".mongo-test-uri"), "utf8").trim();
    await mongoose.connect(uri);
  }
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});
