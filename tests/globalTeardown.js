import { unlinkSync } from "fs";
import { join } from "path";

export default async function globalTeardown() {
  if (globalThis.__MONGO_REPLSET__) {
    await globalThis.__MONGO_REPLSET__.stop();
  }
  try {
    unlinkSync(join(process.cwd(), ".mongo-test-uri"));
  } catch {
    // file may not exist
  }
}
