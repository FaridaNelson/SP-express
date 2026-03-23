import { MongoMemoryReplSet } from "mongodb-memory-server";
import { writeFileSync } from "fs";
import { join } from "path";

export default async function globalSetup() {
  const replset = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  const uri = replset.getUri();
  process.env.MONGO_TEST_URI = uri;

  // Write URI to file for workers to read
  writeFileSync(join(process.cwd(), ".mongo-test-uri"), uri);

  // Store for globalTeardown (works with --runInBand)
  globalThis.__MONGO_REPLSET__ = replset;
}
